import type { ParsedDocumentInput } from "@/lib/file-parser";
import {
  answerCampusQuestionLocal,
  extractNoticeFromDocumentLocal,
  type LocalExtractedIngestPayload,
  verifyCampusRumorLocal,
} from "@/lib/local-engine";
import type {
  AskCitation,
  AskResponse,
  AudienceType,
  ConflictResolution,
  ExtractedDeadlineSuggestion,
  Notice,
  PageReference,
  RumorVerdict,
  StudentProfile,
  SuggestedEmail,
  UrgencyLevel,
  VerifyRumorResponse,
} from "@/types/campus";

export type EngineName = string;
export type EngineStatus = "ai" | "built-in";
export type ExtractedIngestPayload = LocalExtractedIngestPayload;

type ProviderProtocol = "openai_compatible" | "gemini" | "anthropic";

interface ProviderSpec {
  id: string;
  protocol: ProviderProtocol;
  apiKey: string;
  baseUrl: string;
  models: string[];
  supportsVision: boolean;
  supportsJsonResponseFormat: boolean;
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

let cachedGroqModels: { apiKey: string; ids: string[]; fetchedAt: number } | null =
  null;

async function getGroqAvailableModelIds(apiKey: string): Promise<string[]> {
  const now = Date.now();
  if (
    cachedGroqModels &&
    cachedGroqModels.apiKey === apiKey &&
    now - cachedGroqModels.fetchedAt < 60_000
  ) {
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
    cachedGroqModels = { apiKey, ids, fetchedAt: now };
    return ids;
  } catch {
    return [];
  }
}

function inferProviderFromKey(
  apiKey: string,
  customBaseUrl?: string,
  customModel?: string
): ProviderSpec {
  const cleanBase = customBaseUrl?.trim().replace(/\/+$/, "");
  const modelList = (defaults: string[]) =>
    customModel?.trim()
      ? [customModel.trim(), ...defaults.filter((m) => m !== customModel.trim())]
      : defaults;

  if (cleanBase) {
    return {
      id: "custom-openai-compatible",
      protocol: "openai_compatible",
      apiKey,
      baseUrl: cleanBase,
      models: modelList(["gpt-4o-mini", "llama-3.3-70b-versatile"]),
      supportsVision: true,
      supportsJsonResponseFormat: true,
    };
  }

  if (apiKey.startsWith("AIza")) {
    return {
      id: "gemini",
      protocol: "gemini",
      apiKey,
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      models: modelList(["gemini-2.5-flash", "gemini-2.0-flash"]),
      supportsVision: true,
      supportsJsonResponseFormat: true,
    };
  }

  if (apiKey.startsWith("sk-ant-")) {
    return {
      id: "anthropic",
      protocol: "anthropic",
      apiKey,
      baseUrl: "https://api.anthropic.com/v1",
      models: modelList(["claude-3-5-haiku-latest", "claude-3-7-sonnet-latest"]),
      supportsVision: true,
      supportsJsonResponseFormat: false,
    };
  }

  if (apiKey.startsWith("sk-or-")) {
    return {
      id: "openrouter",
      protocol: "openai_compatible",
      apiKey,
      baseUrl: "https://openrouter.ai/api/v1",
      models: modelList([
        "google/gemini-2.0-flash-001",
        "openai/gpt-4o-mini",
        "meta-llama/llama-3.3-70b-instruct",
      ]),
      supportsVision: true,
      supportsJsonResponseFormat: true,
    };
  }

  if (apiKey.startsWith("gsk_")) {
    return {
      id: "groq",
      protocol: "openai_compatible",
      apiKey,
      baseUrl: "https://api.groq.com/openai/v1",
      models: modelList([
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
      ]),
      supportsVision: false, // Dynamically verified via /models below
      supportsJsonResponseFormat: true,
    };
  }

  if (apiKey.startsWith("csk-")) {
    return {
      id: "cerebras",
      protocol: "openai_compatible",
      apiKey,
      baseUrl: "https://api.cerebras.ai/v1",
      models: modelList(["llama-3.3-70b", "llama3.1-8b"]),
      supportsVision: false,
      supportsJsonResponseFormat: true,
    };
  }

  if (apiKey.startsWith("xai-")) {
    return {
      id: "xai",
      protocol: "openai_compatible",
      apiKey,
      baseUrl: "https://api.x.ai/v1",
      models: modelList(["grok-2-latest"]),
      supportsVision: true,
      supportsJsonResponseFormat: true,
    };
  }

  return {
    id: "openai",
    protocol: "openai_compatible",
    apiKey,
    baseUrl: "https://api.openai.com/v1",
    models: modelList(["gpt-4o-mini", "gpt-4.1-mini"]),
    supportsVision: true,
    supportsJsonResponseFormat: true,
  };
}

function resolveConfiguredProviders(): ProviderSpec[] {
  const candidates: Array<{
    key?: string;
    forcedId?: ProviderSpec["id"];
    protocol?: ProviderProtocol;
    baseUrl?: string;
    models: string[];
    supportsVision: boolean;
  }> = [
    {
      key: process.env.AI_API_KEY?.trim(),
      baseUrl: process.env.AI_BASE_URL?.trim(),
      models: process.env.AI_MODEL?.trim() ? [process.env.AI_MODEL.trim()] : [],
      supportsVision: true,
    },
    {
      key:
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim(),
      forcedId: "gemini",
      protocol: "gemini",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      models: [
        process.env.GEMINI_MODEL?.trim(),
        "gemini-2.5-flash",
        "gemini-2.0-flash",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: true,
    },
    {
      key: process.env.OPENAI_API_KEY?.trim(),
      forcedId: "openai",
      protocol: "openai_compatible",
      baseUrl: process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1",
      models: [
        process.env.OPENAI_MODEL?.trim(),
        "gpt-4o-mini",
        "gpt-4.1-mini",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: true,
    },
    {
      key: process.env.OPENROUTER_API_KEY?.trim(),
      forcedId: "openrouter",
      protocol: "openai_compatible",
      baseUrl: "https://openrouter.ai/api/v1",
      models: [
        process.env.OPENROUTER_MODEL?.trim(),
        "google/gemini-2.0-flash-001",
        "openai/gpt-4o-mini",
        "meta-llama/llama-3.3-70b-instruct",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: true,
    },
    {
      key: process.env.GROQ_API_KEY?.trim(),
      forcedId: "groq",
      protocol: "openai_compatible",
      baseUrl: "https://api.groq.com/openai/v1",
      models: [
        process.env.GROQ_MODEL?.trim(),
        "openai/gpt-oss-120b",
        "qwen/qwen3.8-27b",
        "openai/gpt-oss-20b",
        "llama-3.3-70b-versatile",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: false,
    },
    {
      key: process.env.ANTHROPIC_API_KEY?.trim(),
      forcedId: "anthropic",
      protocol: "anthropic",
      baseUrl: "https://api.anthropic.com/v1",
      models: [
        process.env.ANTHROPIC_MODEL?.trim(),
        "claude-3-5-haiku-latest",
        "claude-3-7-sonnet-latest",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: true,
    },
    {
      key: process.env.DEEPSEEK_API_KEY?.trim(),
      forcedId: "deepseek",
      protocol: "openai_compatible",
      baseUrl: "https://api.deepseek.com",
      models: [process.env.DEEPSEEK_MODEL?.trim(), "deepseek-chat"].filter(
        (m): m is string => Boolean(m)
      ),
      supportsVision: false,
    },
    {
      key: process.env.MISTRAL_API_KEY?.trim(),
      forcedId: "mistral",
      protocol: "openai_compatible",
      baseUrl: "https://api.mistral.ai/v1",
      models: [
        process.env.MISTRAL_MODEL?.trim(),
        "mistral-small-latest",
        "pixtral-12b-2409",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: true,
    },
    {
      key: process.env.CEREBRAS_API_KEY?.trim(),
      forcedId: "cerebras",
      protocol: "openai_compatible",
      baseUrl: "https://api.cerebras.ai/v1",
      models: [process.env.CEREBRAS_MODEL?.trim(), "llama-3.3-70b"].filter(
        (m): m is string => Boolean(m)
      ),
      supportsVision: false,
    },
    {
      key: process.env.TOGETHER_API_KEY?.trim(),
      forcedId: "together",
      protocol: "openai_compatible",
      baseUrl: "https://api.together.xyz/v1",
      models: [
        process.env.TOGETHER_MODEL?.trim(),
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      ].filter((m): m is string => Boolean(m)),
      supportsVision: false,
    },
    {
      key: process.env.XAI_API_KEY?.trim(),
      forcedId: "xai",
      protocol: "openai_compatible",
      baseUrl: "https://api.x.ai/v1",
      models: [process.env.XAI_MODEL?.trim(), "grok-2-latest"].filter(
        (m): m is string => Boolean(m)
      ),
      supportsVision: true,
    },
  ];

  const resolved: ProviderSpec[] = [];
  const seen = new Set<string>();

  for (const item of candidates) {
    if (!item.key) continue;
    const inferred = inferProviderFromKey(
      item.key,
      item.forcedId ? item.baseUrl : item.baseUrl,
      item.models[0]
    );
    // Honor key-prefix mismatch (e.g. an OpenAI/Gemini key pasted into GROQ_API_KEY or AI_API_KEY)
    const spec: ProviderSpec =
      item.forcedId && inferred.id === item.forcedId
        ? {
            id: item.forcedId,
            protocol: item.protocol!,
            apiKey: item.key,
            baseUrl: (item.baseUrl ?? inferred.baseUrl).replace(/\/+$/, ""),
            models: item.models.length > 0 ? item.models : inferred.models,
            supportsVision: item.supportsVision,
            supportsJsonResponseFormat: item.protocol !== "anthropic",
          }
        : inferred;

    const dedupeKey = `${spec.id}:${spec.baseUrl}:${spec.apiKey}`;
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      resolved.push(spec);
    }
  }

  return resolved;
}

export function getEngineStatus(): EngineStatus {
  return resolveConfiguredProviders().length > 0 ? "ai" : "built-in";
}

const SYSTEM_INSTRUCTION =
  "You are UniBrief AI. Return strictly valid JSON matching the exact requested schema with zero hallucination. Output raw JSON only.";

function buildCombinedPrompt(
  promptText: string,
  attachedDocs: ParsedDocumentInput[]
): string {
  const extraTextSections = attachedDocs
    .filter((d) => d.kind !== "image")
    .map((doc) => {
      if (doc.textContent) {
        return `--- ATTACHED FILE: ${doc.fileName} (${doc.mimeType}) ---\n${doc.textContent.slice(0, 28000)}`;
      }
      return `--- ATTACHED FILE: ${doc.fileName} (${doc.mimeType}) ---\n[No extractable text layer; PDF appears scanned. If unreadable without vision, note limitation clearly.]`;
    });

  return [promptText, ...extraTextSections].join("\n\n");
}

async function callOpenAiCompatible<T>(
  spec: ProviderSpec,
  combinedPrompt: string,
  imageDocs: ParsedDocumentInput[],
  attemptIndex: number
): Promise<{ data: T; model: string }> {
  let candidates = spec.models;

  if (spec.id === "groq") {
    const available = await getGroqAvailableModelIds(spec.apiKey);
    if (imageDocs.length > 0) {
      const visionModels = available.filter(
        (id) =>
          id.includes("vision") ||
          id.includes("llama-4") ||
          id.includes("maverick") ||
          id.includes("scout")
      );
      if (visionModels.length === 0) {
        throw new Error("NO_VISION_MODEL");
      }
      candidates = visionModels;
    } else if (available.length > 0) {
      const filtered = spec.models.filter((m) => available.includes(m));
      if (filtered.length > 0) {
        candidates = filtered;
      } else {
        const fallbackText = available.find(
          (id) =>
            !id.includes("whisper") &&
            !id.includes("tts") &&
            !id.includes("guard")
        );
        if (fallbackText) candidates = [fallbackText];
      }
    }
  } else if (imageDocs.length > 0 && !spec.supportsVision) {
    throw new Error("NO_VISION_MODEL");
  }

  const model = candidates[attemptIndex % candidates.length] ?? candidates[0];
  const content =
    imageDocs.length > 0
      ? [
          { type: "text" as const, text: combinedPrompt },
          ...imageDocs.map((img) => ({
            type: "image_url" as const,
            image_url: {
              url: `data:${img.mimeType};base64,${img.base64Data}`,
            },
          })),
        ]
      : combinedPrompt;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${spec.apiKey}`,
    "Content-Type": "application/json",
  };
  if (spec.id === "openrouter") {
    headers["HTTP-Referer"] = "https://unibrief.vercel.app";
    headers["X-Title"] = "UniBrief";
  }

  const body: Record<string, unknown> = {
    model,
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_INSTRUCTION },
      { role: "user", content },
    ],
  };
  if (spec.supportsJsonResponseFormat && attemptIndex === 0) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(`${spec.baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    const retryAfterSec = Number(res.headers.get("retry-after") ?? "0");
    const err = new Error(
      `${spec.id} API ${res.status}: ${errText.slice(0, 300)}`
    ) as Error & { retryAfterMs?: number };
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
    throw new Error(`Empty response returned from ${spec.id}.`);
  }
  return { data: cleanAndParseJson<T>(raw), model };
}

async function callGemini<T>(
  spec: ProviderSpec,
  combinedPrompt: string,
  imageDocs: ParsedDocumentInput[],
  attemptIndex: number
): Promise<{ data: T; model: string }> {
  const model = spec.models[attemptIndex % spec.models.length] ?? spec.models[0];
  const parts: Array<Record<string, unknown>> = [{ text: combinedPrompt }];
  for (const img of imageDocs) {
    if (img.base64Data) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.base64Data,
        },
      });
    }
  }

  const res = await fetch(
    `${spec.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(spec.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`gemini API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const raw =
    payload.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("") ?? "";
  if (!raw.trim()) {
    throw new Error("Empty response returned from gemini.");
  }
  return { data: cleanAndParseJson<T>(raw), model };
}

async function callAnthropic<T>(
  spec: ProviderSpec,
  combinedPrompt: string,
  imageDocs: ParsedDocumentInput[],
  attemptIndex: number
): Promise<{ data: T; model: string }> {
  const model = spec.models[attemptIndex % spec.models.length] ?? spec.models[0];
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: combinedPrompt },
  ];
  for (const img of imageDocs) {
    if (img.base64Data) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: img.mimeType,
          data: img.base64Data,
        },
      });
    }
  }

  const res = await fetch(`${spec.baseUrl}/messages`, {
    method: "POST",
    headers: {
      "x-api-key": spec.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: 0.1,
      system: SYSTEM_INSTRUCTION,
      messages: [{ role: "user", content }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`anthropic API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };
  const raw =
    payload.content
      ?.filter((c) => c.type === "text")
      .map((c) => c.text ?? "")
      .join("") ?? "";
  if (!raw.trim()) {
    throw new Error("Empty response returned from anthropic.");
  }
  return { data: cleanAndParseJson<T>(raw), model };
}

async function invokeProvider<T>(
  spec: ProviderSpec,
  promptText: string,
  attachedDocs: ParsedDocumentInput[],
  attemptIndex: number
): Promise<{ data: T; model: string }> {
  const imageDocs = attachedDocs.filter(
    (d) => d.kind === "image" && d.base64Data
  );
  const combinedPrompt = buildCombinedPrompt(promptText, attachedDocs);

  if (spec.protocol === "gemini") {
    return callGemini<T>(spec, combinedPrompt, imageDocs, attemptIndex);
  }
  if (spec.protocol === "anthropic") {
    return callAnthropic<T>(spec, combinedPrompt, imageDocs, attemptIndex);
  }
  return callOpenAiCompatible<T>(spec, combinedPrompt, imageDocs, attemptIndex);
}

async function generateStructuredJsonWithProviders<T>(
  promptText: string,
  attachedDocs: ParsedDocumentInput[] = []
): Promise<{ data: T; engineUsed: EngineName } | null> {
  const providers = resolveConfiguredProviders();
  if (providers.length === 0) {
    return null;
  }

  const maxAttemptsPerProvider = 2;
  const backoffsMs = [600, 1400];
  let lastError: unknown = null;

  for (const provider of providers) {
    for (let attempt = 1; attempt <= maxAttemptsPerProvider; attempt++) {
      try {
        const { data, model } = await invokeProvider<T>(
          provider,
          promptText,
          attachedDocs,
          attempt - 1
        );
        return { data, engineUsed: model };
      } catch (err) {
        if (err instanceof Error && err.message === "NO_VISION_MODEL") {
          lastError = err;
          break; // Try next provider that supports vision
        }
        lastError = err;
        if (attempt < maxAttemptsPerProvider && isRetryableError(err)) {
          const hintedMs =
            err && typeof err === "object" && "retryAfterMs" in err
              ? Number((err as { retryAfterMs?: unknown }).retryAfterMs)
              : 0;
          await sleep(
            Math.max(
              backoffsMs[attempt - 1] ?? 1200,
              Number.isFinite(hintedMs) ? hintedMs : 0
            )
          );
          continue;
        }
        break;
      }
    }
  }

  // Image-only scans cannot be read deterministically without a vision-capable model
  const hasImageOnly = attachedDocs.some(
    (d) => d.kind === "image" && !d.textContent
  );
  if (
    hasImageOnly ||
    process.env.AI_ALLOW_LOCAL_FALLBACK === "false"
  ) {
    if (lastError instanceof Error && lastError.message === "NO_VISION_MODEL") {
      throw new Error(
        "Image/scan OCR requires a vision-capable AI key (such as GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY) on the server, or upload PDF/DOCX/TXT instead."
      );
    }
    throw lastError instanceof Error
      ? lastError
      : new Error("Configured AI providers failed.");
  }

  return null;
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

  const aiResult =
    await generateStructuredJsonWithProviders<Partial<ExtractedIngestPayload>>(
      prompt,
      [doc]
    );

  if (!aiResult) {
    if (doc.kind === "image" && !doc.textContent) {
      throw new Error(
        "Image/scan OCR requires a vision-capable AI key (GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY) on the server, or upload PDF/DOCX/TXT instead."
      );
    }
    return extractNoticeFromDocumentLocal(doc, existingTopics);
  }

  const { data, engineUsed } = aiResult;

  const validBranches =
    Array.isArray(data.target_branches) && data.target_branches.length > 0
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
            typeof d.due_date === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(d.due_date)
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
  const aiResult =
    await generateStructuredJsonWithProviders<Partial<AskResponse>>(prompt, docs);

  if (!aiResult) {
    if (attachment?.kind === "image" && !attachment.textContent) {
      throw new Error(
        "Image attachment reading requires a vision-capable AI key (GEMINI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY, or ANTHROPIC_API_KEY) on the server, or attach PDF/DOCX/TXT instead."
      );
    }
    return answerCampusQuestionLocal({ question, profile, notices, attachment });
  }

  const { data, engineUsed } = aiResult;
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
            data.conflict_resolution.note ??
              "Newer active circular overrides previous rule."
          ),
        }
      : null;

  const extractedDeadlines: ExtractedDeadlineSuggestion[] =
    found && Array.isArray(data.extracted_deadlines)
      ? data.extracted_deadlines
          .filter(
            (d) =>
              d &&
              typeof d.title === "string" &&
              /^\d{4}-\d{2}-\d{2}$/.test(String(d.due_date ?? ""))
          )
          .map((d) => ({
            title: d.title.trim(),
            due_date: d.due_date,
            due_time: d.due_time?.trim() || "09:30 AM",
            penalty_impact: d.penalty_impact?.trim() || "Refer official circular",
            circular_no:
              d.circular_no?.trim() || citations[0]?.circular_no || "CAMPUS",
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

  const aiResult =
    await generateStructuredJsonWithProviders<Partial<VerifyRumorResponse>>(
      prompt,
      []
    );

  if (!aiResult) {
    return verifyCampusRumorLocal({ claim, notices });
  }

  const { data, engineUsed } = aiResult;

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
