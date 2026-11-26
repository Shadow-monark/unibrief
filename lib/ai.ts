import type { ParsedDocumentInput } from "@/lib/file-parser";
import type {
  AskCitation,
  AskResponse,
  AudienceType,
  ConflictResolution,
  ExtractedDeadlineSuggestion,
  Notice,
  PageReference,
  PolicyRules,
  RumorVerdict,
  StudentProfile,
  SuggestedEmail,
  UrgencyLevel,
  VerifyRumorResponse,
} from "@/types/campus";

export type EngineName = string;

export class MissingApiKeyError extends Error {
  readonly code = "MISSING_API_KEY";
  constructor(message?: string) {
    super(
      message ??
        "GROQ_API_KEY is missing. Add GROQ_API_KEY=your_groq_key_here to .env.local (see .env.local.example) and restart the server."
    );
    this.name = "MissingApiKeyError";
  }
}

export function getEngineStatus(): "groq" | "unconfigured" {
  return process.env.GROQ_API_KEY?.trim() ? "groq" : "unconfigured";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanAndParseJson<T>(rawText: string): T {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(candidate.slice(firstBrace, lastBrace + 1)) as T;
    }
    throw new Error("Model response was not valid JSON.");
  }
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("json_validate_failed") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("quota") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("not valid json") ||
    msg.includes("empty response") ||
    msg.includes("fetch failed") ||
    msg.includes("timeout")
  );
}

interface GroqMessageContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}

const GROQ_TEXT_CANDIDATES = [
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
  "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile",
];

let cachedGroqModels: { ids: string[]; fetchedAt: number } | null = null;

async function getGroqAvailableModelIds(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (cachedGroqModels && now - cachedGroqModels.fetchedAt < 60_000) {
    return cachedGroqModels.ids;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<{ id?: string }> };
    const ids = (data.data ?? [])
      .map((m) => m.id)
      .filter((id): id is string => Boolean(id));
    cachedGroqModels = { ids, fetchedAt: now };
    return ids;
  } catch {
    return [];
  }
}

async function resolveGroqModel(
  apiKey: string,
  hasImages: boolean,
  attemptIndex: number
): Promise<string> {
  const envModel = process.env.GROQ_MODEL?.trim();
  const available = await getGroqAvailableModelIds(apiKey);

  if (hasImages) {
    const visionModel = available.find(
      (id) =>
        id.includes("vision") ||
        id.includes("llama-4-scout") ||
        id.includes("llama-4-maverick")
    );
    if (visionModel) return visionModel;
    throw new Error(
      "Image/scan OCR requires a Groq vision model (e.g. llama-4-scout), which is not enabled on this GROQ_API_KEY. Please upload PDF, DOCX, or TXT, or paste the circular text."
    );
  }

  const orderedPool = Array.from(
    new Set([
      ...(envModel ? [envModel] : []),
      ...GROQ_TEXT_CANDIDATES,
      ...available.filter(
        (id) =>
          !id.includes("whisper") &&
          !id.includes("orpheus") &&
          !id.includes("guard")
      ),
    ])
  );

  const filteredPool =
    available.length > 0
      ? orderedPool.filter((id) => available.includes(id))
      : orderedPool;

  if (filteredPool.length > 0) {
    return filteredPool[attemptIndex % filteredPool.length];
  }

  return "openai/gpt-oss-120b";
}

async function callGroqJson<T>(
  apiKey: string,
  promptText: string,
  attachedDocs: ParsedDocumentInput[],
  attemptIndex: number
): Promise<{ data: T; model: string }> {
  const imageDocs = attachedDocs.filter(
    (d) => d.kind === "image" && d.base64Data
  );
  const hasImages = imageDocs.length > 0;
  const model = await resolveGroqModel(apiKey, hasImages, attemptIndex);

  const extraTextSections = attachedDocs
    .filter((d) => d.kind !== "image")
    .map((doc) => {
      if (doc.textContent) {
        return `--- ATTACHED FILE: ${doc.fileName} (${doc.mimeType}) ---\n${doc.textContent.slice(0, 28000)}`;
      }
      return `--- ATTACHED FILE: ${doc.fileName} (${doc.mimeType}) ---\n[No extractable text layer; PDF appears scanned. If unreadable without vision, note limitation clearly.]`;
    });

  const combinedPrompt = [promptText, ...extraTextSections].join("\n\n");

  const content: string | GroqMessageContentPart[] = hasImages
    ? [
        { type: "text", text: combinedPrompt },
        ...imageDocs.map(
          (img): GroqMessageContentPart => ({
            type: "image_url",
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64Data}`,
            },
          })
        ),
      ]
    : combinedPrompt;

  const useJsonFormat = attemptIndex === 0;
  const requestBody: Record<string, unknown> = {
    model,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          "You are UniBrief AI. Return strictly valid JSON matching the exact requested schema with zero hallucination. Output raw JSON only.",
      },
      {
        role: "user",
        content,
      },
    ],
  };
  if (useJsonFormat) {
    requestBody.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const retryAfterSec = Number(res.headers.get("retry-after") ?? "0");
    const err = new Error(`Groq API ${res.status}: ${errText.slice(0, 300)}`) as Error & {
      retryAfterMs?: number;
    };
    if (res.status === 429 && Number.isFinite(retryAfterSec) && retryAfterSec > 0) {
      err.retryAfterMs = Math.min(6000, Math.ceil(retryAfterSec * 1000));
    }
    throw err;
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content;
  if (!raw || !raw.trim()) {
    throw new Error("Empty response returned from Groq.");
  }
  return { data: cleanAndParseJson<T>(raw), model };
}

async function generateStructuredJsonWithRetry<T>(
  promptText: string,
  attachedDocs: ParsedDocumentInput[] = []
): Promise<{ data: T; engineUsed: EngineName }> {
  const groqKey = process.env.GROQ_API_KEY?.trim();

  if (!groqKey) {
    throw new MissingApiKeyError();
  }

  const maxAttempts = 3;
  const backoffsMs = [600, 1400, 2800];
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { data, model } = await callGroqJson<T>(
        groqKey,
        promptText,
        attachedDocs,
        attempt - 1
      );
      return { data, engineUsed: model };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && isRetryableError(err)) {
        const hintedMs =
          err && typeof err === "object" && "retryAfterMs" in err
            ? Number((err as { retryAfterMs?: unknown }).retryAfterMs)
            : 0;
        const waitMs = Math.max(
          backoffsMs[attempt - 1] ?? 1500,
          Number.isFinite(hintedMs) ? hintedMs : 0
        );
        await sleep(waitMs);
        continue;
      }
      break;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Groq AI generation failed after retry attempts.");
}

export interface ExtractedIngestPayload {
  circular_no: string;
  title: string;
  summary: string;
  extracted_text: string;
  page_references: PageReference[];
  topic_tag: string;
  effective_date: string;
  supersedes_previous: boolean;
  target_branches: string[];
  target_semesters: number[];
  audience_type: AudienceType;
  policy_rules: PolicyRules | null;
  deadlines: Array<{
    title: string;
    due_date: string;
    due_time: string;
    penalty_impact: string;
    urgency: UrgencyLevel;
    action_url: string | null;
  }>;
}

export async function extractNoticeFromDocument(
  doc: ParsedDocumentInput,
  existingTopics: string[]
): Promise<{ payload: ExtractedIngestPayload; engineUsed: EngineName }> {
  const todayIso = new Date().toISOString().slice(0, 10);
  const prompt = `You are a university Registrar and Examination Cell document extraction engine.
Analyze the attached campus circular/notice (${doc.fileName}) — it may be a PDF, DOCX, TXT, scanned image, notice-board photo, or bilingual Hindi-English circular.

Today's reference date: ${todayIso}.
Existing topic tags in the database (reuse an exact matching tag whenever this circular belongs to the same policy/schedule domain so conflict resolution catches updates!):
${JSON.stringify(existingTopics)}

Extract and return STRICT JSON matching this exact shape:
{
  "circular_no": "Official circular reference number, e.g. EXAM/2026/112 or generated ID like NOTICE/2026/001 if absent",
  "title": "Concise official title of the notice",
  "summary": "2-3 sentence crisp factual summary highlighting key rule changes, dates, and penalties",
  "extracted_text": "Clean verbatim or near-verbatim transcribed text of the entire circular/notice",
  "page_references": [
    { "page": 1, "excerpt": "Exact verbatim sentence/clause from page 1" }
  ],
  "topic_tag": "snake_case tag, e.g. midsem_schedule, fee_deadline, lab_submission, medical_leave, hostel_curfew, scholarship, placement",
  "effective_date": "YYYY-MM-DD (if year missing, infer 2026)",
  "supersedes_previous": true/false (true if notice explicitly revises, postpones, updates, cancels, or supersedes an earlier notice/date),
  "target_branches": ["All"] or subset of ["CSE", "AIML", "ECE", "ME"],
  "target_semesters": [1,2,3,4,5,6,7,8] or specific semester numbers like [3],
  "audience_type": "all" | "hosteller" | "day_scholar",
  "policy_rules": null OR { "min_attendance": number, "medical_min": number, "clause": string, "submission_days": number },
  "deadlines": [
    {
      "title": "Actionable deadline title",
      "due_date": "YYYY-MM-DD",
      "due_time": "e.g. 05:00 PM or 11:59 PM",
      "penalty_impact": "Explicit fine, mark deduction, detention, or entry ban consequence",
      "urgency": "critical" | "high" | "normal",
      "action_url": null or "https://..."
    }
  ]
}

Rules:
- Never fabricate deadlines or policy numbers not present in the document.
- If the notice contains Hindi/Hinglish phrases, translate/summarize clearly into English while preserving exact circular numbers, dates, and ₹ fine amounts.`;

  const { data, engineUsed } =
    await generateStructuredJsonWithRetry<Partial<ExtractedIngestPayload>>(
      prompt,
      [doc]
    );

  const validBranches = Array.isArray(data.target_branches) && data.target_branches.length > 0
    ? data.target_branches.map((b) => String(b).trim()).filter(Boolean)
    : ["All"];

  const validSemesters =
    Array.isArray(data.target_semesters) && data.target_semesters.length > 0
      ? data.target_semesters
          .map((s) => Number(s))
          .filter((s) => Number.isInteger(s) && s >= 1 && s <= 8)
      : [1, 2, 3, 4, 5, 6, 7, 8];

  const audience: AudienceType =
    data.audience_type === "hosteller" || data.audience_type === "day_scholar"
      ? data.audience_type
      : "all";

  const effectiveDate =
    typeof data.effective_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data.effective_date)
      ? data.effective_date
      : todayIso;

  const pageRefs: PageReference[] = Array.isArray(data.page_references)
    ? data.page_references
        .filter((r) => r && typeof r.excerpt === "string" && r.excerpt.trim())
        .map((r) => ({
          page: typeof r.page === "number" && r.page > 0 ? r.page : 1,
          excerpt: r.excerpt.trim(),
        }))
    : [];

  const extractedText =
    typeof data.extracted_text === "string" && data.extracted_text.trim()
      ? data.extracted_text.trim()
      : doc.textContent?.trim() || "Extracted via multimodal document scan.";

  if (pageRefs.length === 0 && extractedText) {
    pageRefs.push({
      page: 1,
      excerpt: extractedText.slice(0, 260),
    });
  }

  const deadlines = Array.isArray(data.deadlines)
    ? data.deadlines
        .filter((d) => d && typeof d.title === "string" && d.title.trim())
        .map((d) => ({
          title: d.title.trim(),
          due_date:
            typeof d.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.due_date)
              ? d.due_date
              : effectiveDate,
          due_time:
            typeof d.due_time === "string" && d.due_time.trim()
              ? d.due_time.trim()
              : "05:00 PM",
          penalty_impact:
            typeof d.penalty_impact === "string" && d.penalty_impact.trim()
              ? d.penalty_impact.trim()
              : "Refer official circular",
          urgency: (d.urgency === "critical" ||
          d.urgency === "high" ||
          d.urgency === "normal"
            ? d.urgency
            : "high") as UrgencyLevel,
          action_url:
            typeof d.action_url === "string" && d.action_url.startsWith("http")
              ? d.action_url
              : null,
        }))
    : [];

  return {
    engineUsed,
    payload: {
      circular_no:
        typeof data.circular_no === "string" && data.circular_no.trim()
          ? data.circular_no.trim()
          : `CAMPUS/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`,
      title:
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : doc.fileName,
      summary:
        typeof data.summary === "string" && data.summary.trim()
          ? data.summary.trim()
          : extractedText.slice(0, 240),
      extracted_text: extractedText,
      page_references: pageRefs,
      topic_tag:
        typeof data.topic_tag === "string" && data.topic_tag.trim()
          ? data.topic_tag.trim().toLowerCase().replace(/\s+/g, "_")
          : "general_notice",
      effective_date: effectiveDate,
      supersedes_previous: Boolean(data.supersedes_previous),
      target_branches: validBranches,
      target_semesters: validSemesters,
      audience_type: audience,
      policy_rules:
        data.policy_rules && typeof data.policy_rules === "object"
          ? {
              min_attendance:
                typeof data.policy_rules.min_attendance === "number"
                  ? data.policy_rules.min_attendance
                  : undefined,
              medical_min:
                typeof data.policy_rules.medical_min === "number"
                  ? data.policy_rules.medical_min
                  : undefined,
              clause:
                typeof data.policy_rules.clause === "string"
                  ? data.policy_rules.clause
                  : undefined,
              submission_days:
                typeof data.policy_rules.submission_days === "number"
                  ? data.policy_rules.submission_days
                  : undefined,
            }
          : null,
      deadlines,
    },
  };
}

function serializeNoticesForPrompt(notices: Notice[]): string {
  return notices
    .map((n) => {
      const refs = n.page_references
        .map((r) => `  - [Page ${r.page}]: "${r.excerpt}"`)
        .join("\n");
      return [
        `NOTICE ID: ${n.id}`,
        `CIRCULAR NO: ${n.circular_no}`,
        `STATUS: ${n.status.toUpperCase()}${n.superseded_by_id ? ` (superseded_by_id: ${n.superseded_by_id})` : ""}`,
        `TOPIC: ${n.topic_tag} | EFFECTIVE DATE: ${n.effective_date}`,
        `TARGET: Branches=${n.target_branches.join(",")}, Semesters=${n.target_semesters.join(",")}, Audience=${n.audience_type}`,
        `TITLE: ${n.title}`,
        `SUMMARY: ${n.summary}`,
        `PAGE REFERENCES:\n${refs}`,
        `FULL TEXT:\n${n.extracted_text}`,
      ].join("\n");
    })
    .join("\n\n========================================\n\n");
}

function sanitizeCitations(
  rawCitations: unknown,
  notices: Notice[]
): AskCitation[] {
  if (!Array.isArray(rawCitations)) return [];
  const byId = new Map(notices.map((n) => [n.id, n]));
  const byCircular = new Map(
    notices.map((n) => [n.circular_no.toUpperCase(), n])
  );

  const sanitized: AskCitation[] = [];
  for (const item of rawCitations) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const matched =
      (typeof obj.notice_id === "string" ? byId.get(obj.notice_id) : undefined) ??
      (typeof obj.circular_no === "string"
        ? byCircular.get(obj.circular_no.trim().toUpperCase())
        : undefined);
    if (!matched) continue;

    const fallbackRef = matched.page_references[0];
    sanitized.push({
      notice_id: matched.id,
      circular_no: matched.circular_no,
      title: matched.title,
      page:
        typeof obj.page === "number" && obj.page > 0
          ? obj.page
          : fallbackRef?.page ?? 1,
      excerpt:
        typeof obj.excerpt === "string" && obj.excerpt.trim()
          ? obj.excerpt.trim()
          : fallbackRef?.excerpt ?? matched.summary,
      status: matched.status,
      effective_date: matched.effective_date,
    });
  }
  return sanitized;
}

export async function answerCampusQuestion(params: {
  question: string;
  profile: StudentProfile;
  notices: Notice[];
  attachment?: ParsedDocumentInput | null;
}): Promise<AskResponse> {
  const { question, profile, notices, attachment } = params;
  const prompt = `You are UniBrief, an authoritative, zero-hallucination university academic assistant.
Student Profile Context:
- Branch: ${profile.branch}
- Semester: ${profile.semester}
- Residence: ${profile.residence}

Official Campus Circulars Repository (includes ACTIVE and SUPERSEDED notices for conflict detection):
${notices.length > 0 ? serializeNoticesForPrompt(notices) : "NO OFFICIAL CIRCULARS IN REPOSITORY."}

${
  attachment
    ? `The student ALSO attached a personal document ("${attachment.fileName}") for one-off Q&A alongside official records.`
    : ""
}

Student Question:
"${question}"

STRICT GROUNDING RULES:
1. Answer ONLY from the provided Official Campus Circulars (or the student's attached document if applicable).
2. NEVER invent dates, fees, clauses, room numbers, holidays, or rules not explicitly written above.
3. If the answer IS explicitly present in the Official Campus Circulars OR in the student's attached document, set "found_in_official_records": true (meaning grounded evidence, not hallucinated). Only if the answer is NOT found in EITHER the provided official records NOR any attached document, set "found_in_official_records": false, keep "citations": [], "extracted_deadlines": [], "suggested_email": null, and state clearly in "answer" that no official circular covers this query and advise verifying with the Registrar/HOD Office.
4. If an ACTIVE circular superseded an OLDER circular on the topic being asked about (for example EXAM/2026/104 replacing EXAM/2026/088), populate "conflict_resolution" accurately showing both the superseded rule and the active verified rule!
5. Whenever an action/request email to HOD, Exam Cell, or Accounts makes sense (e.g., medical leave application, exam fee/form clarification, lab extension/submission), provide a crisp "suggested_email" citing the exact circular number and clause.

Return STRICT JSON matching this exact schema:
{
  "answer": "Clear, direct answer citing circular numbers and exact dates/clauses.",
  "found_in_official_records": true/false,
  "conflict_resolution": null OR {
    "detected": true,
    "topic_tag": "string",
    "superseded_circular_no": "string",
    "superseded_rule": "Short summary of old rule/date",
    "active_circular_no": "string",
    "active_rule": "Short summary of new verified rule/date",
    "note": "Brief verification note"
  },
  "citations": [
    {
      "notice_id": "exact NOTICE ID from above",
      "circular_no": "exact CIRCULAR NO from above",
      "page": 1,
      "excerpt": "Verbatim excerpt from the notice"
    }
  ],
  "extracted_deadlines": [
    {
      "title": "Action title",
      "due_date": "YYYY-MM-DD",
      "due_time": "HH:MM AM/PM",
      "penalty_impact": "Consequence if missed",
      "circular_no": "Circular number"
    }
  ],
  "suggested_email": null OR {
    "subject": "Formal academic email subject line",
    "recipient_role": "e.g. Head of Department (CSE) / Controller of Examinations",
    "body_template": "Polite formal email body citing circular number & clause with placeholders [Student Name], [Roll No], [Section] only if needed",
    "cited_circular_no": "Circular number",
    "cited_clause": "Clause 4.2 or null"
  }
}`;

  const docs = attachment ? [attachment] : [];
  const { data, engineUsed } =
    await generateStructuredJsonWithRetry<Partial<AskResponse>>(prompt, docs);

  const found = Boolean(data.found_in_official_records);
  const citations = found ? sanitizeCitations(data.citations, notices) : [];

  const conflict: ConflictResolution | null =
    found &&
    data.conflict_resolution &&
    typeof data.conflict_resolution === "object" &&
    data.conflict_resolution.detected
      ? {
          detected: true,
          topic_tag: String(data.conflict_resolution.topic_tag ?? ""),
          superseded_circular_no: String(
            data.conflict_resolution.superseded_circular_no ?? ""
          ),
          superseded_rule: String(
            data.conflict_resolution.superseded_rule ?? ""
          ),
          active_circular_no: String(
            data.conflict_resolution.active_circular_no ?? ""
          ),
          active_rule: String(data.conflict_resolution.active_rule ?? ""),
          note: String(
            data.conflict_resolution.note ?? "Newer active circular overrides previous rule."
          ),
        }
      : null;

  const extractedDeadlines: ExtractedDeadlineSuggestion[] =
    found && Array.isArray(data.extracted_deadlines)
      ? data.extracted_deadlines
          .filter((d) => d && typeof d.title === "string" && /^\d{4}-\d{2}-\d{2}$/.test(String(d.due_date ?? "")))
          .map((d) => ({
            title: d.title.trim(),
            due_date: d.due_date,
            due_time: d.due_time?.trim() || "09:30 AM",
            penalty_impact: d.penalty_impact?.trim() || "Refer official circular",
            circular_no: d.circular_no?.trim() || citations[0]?.circular_no || "CAMPUS",
          }))
      : [];

  const suggestedEmail: SuggestedEmail | null =
    found &&
    data.suggested_email &&
    typeof data.suggested_email === "object" &&
    typeof data.suggested_email.subject === "string" &&
    typeof data.suggested_email.body_template === "string"
      ? {
          subject: data.suggested_email.subject.trim(),
          recipient_role:
            data.suggested_email.recipient_role?.trim() || "Registrar / HOD Office",
          body_template: data.suggested_email.body_template.trim(),
          cited_circular_no:
            data.suggested_email.cited_circular_no?.trim() ||
            citations[0]?.circular_no ||
            "Official Circular",
          cited_clause: data.suggested_email.cited_clause ?? null,
        }
      : null;

  return {
    answer:
      typeof data.answer === "string" && data.answer.trim()
        ? data.answer.trim()
        : "No official campus record found covering this query. Please verify with the Registrar or HOD Office.",
    found_in_official_records: found,
    conflict_resolution: conflict,
    citations,
    extracted_deadlines: extractedDeadlines,
    suggested_email: suggestedEmail,
    engine_used: engineUsed,
  };
}

export async function verifyCampusRumor(params: {
  claim: string;
  notices: Notice[];
}): Promise<VerifyRumorResponse> {
  const { claim, notices } = params;
  const prompt = `You are the UniBrief Rumor Buster fact-checking engine.
Evaluate the student's forwarded WhatsApp message/claim strictly against the Official Campus Circulars below.

Official Campus Circulars (including ACTIVE and SUPERSEDED):
${serializeNoticesForPrompt(notices)}

Forwarded Claim / Rumor:
"${claim}"

Classification Rules:
- "VERIFIED": Matches an ACTIVE official circular accurately.
- "OUTDATED": Matches an old/SUPERSEDED circular or stale date that has since been revised by a newer ACTIVE circular (for instance claiming Sem 3 Mid-Sem starts 28 Nov when EXAM/2026/104 shifted it to 04 Dec).
- "UNVERIFIED_RUMOR": Not backed by ANY active or superseded official circular (e.g., sudden holiday claim, unverified WhatsApp rumor).

Return STRICT JSON matching this exact shape:
{
  "verdict": "VERIFIED" | "OUTDATED" | "UNVERIFIED_RUMOR",
  "headline": "Short crisp verdict headline (max 12 words)",
  "explanation": "Factual 2-3 sentence verification referencing exact circular numbers, dates, and clauses.",
  "active_circular_ref": "Active circular_no if relevant, else null",
  "outdated_circular_ref": "Superseded circular_no if relevant, else null",
  "citations": [
    {
      "notice_id": "exact NOTICE ID",
      "circular_no": "exact CIRCULAR NO",
      "page": 1,
      "excerpt": "Verbatim supporting excerpt"
    }
  ]
}`;

  const { data, engineUsed } =
    await generateStructuredJsonWithRetry<Partial<VerifyRumorResponse>>(prompt);

  const verdict: RumorVerdict =
    data.verdict === "VERIFIED" ||
    data.verdict === "OUTDATED" ||
    data.verdict === "UNVERIFIED_RUMOR"
      ? data.verdict
      : "UNVERIFIED_RUMOR";

  return {
    verdict,
    headline:
      typeof data.headline === "string" && data.headline.trim()
        ? data.headline.trim()
        : verdict === "VERIFIED"
          ? "Claim matches active official circular"
          : verdict === "OUTDATED"
            ? "Claim relies on an outdated / superseded circular"
            : "No official circular supports this claim",
    explanation:
      typeof data.explanation === "string" && data.explanation.trim()
        ? data.explanation.trim()
        : "No official campus circular corroborates this forwarded message. Please verify directly on the official notice board or Registrar portal.",
    active_circular_ref:
      typeof data.active_circular_ref === "string"
        ? data.active_circular_ref
        : null,
    outdated_circular_ref:
      typeof data.outdated_circular_ref === "string"
        ? data.outdated_circular_ref
        : null,
    citations: sanitizeCitations(data.citations, notices),
    engine_used: engineUsed,
  };
}
