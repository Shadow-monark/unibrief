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

export interface LocalExtractedIngestPayload {
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

const STOPWORDS = new Set([
  "the",
  "is",
  "are",
  "was",
  "were",
  "am",
  "be",
  "been",
  "a",
  "an",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "from",
  "with",
  "about",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "how",
  "can",
  "could",
  "should",
  "would",
  "do",
  "does",
  "did",
  "my",
  "our",
  "your",
  "me",
  "there",
  "any",
  "all",
  "and",
  "or",
  "if",
  "pe",
  "hai",
  "hain",
  "mein",
  "ka",
  "ki",
  "ke",
  "ko",
  "se",
  "kya",
  "kab",
  "yaar",
  "bhai",
  "please",
  "tell",
  "give",
  "info",
  "information",
  "campus",
  "student",
  "students",
  "college",
  "university",
]);

const SYNONYMS: Record<string, string[]> = {
  midsem: ["mid-sem", "mid-semester", "mid", "sem", "exam", "schedule"],
  mid: ["midsem", "mid-sem", "mid-semester"],
  exam: ["examination", "examinations", "midsem", "endsem", "test"],
  exams: ["exam", "examination", "examinations", "schedule"],
  fee: ["fees", "fine", "penalty", "erp", "payment", "form"],
  fees: ["fee", "fine", "penalty", "erp", "payment"],
  fine: ["penalty", "late", "fee", "500"],
  late: ["fine", "penalty", "extension", "deadline"],
  medical: ["condonation", "doctor", "illness", "hospitalization", "attendance"],
  leave: ["medical", "condonation", "absence", "hod", "application"],
  attendance: ["75%", "65%", "condonation", "medical", "detention"],
  lab: ["practical", "dbms", "python", "cs-302l", "cs-304l", "submission"],
  dbms: ["lab", "practical", "cs-302l", "python"],
  python: ["lab", "practical", "cs-304l", "dbms"],
  deadline: ["due", "date", "last", "submission", "before"],
  postponed: ["shifted", "revised", "extended", "supersedes"],
  superseded: ["outdated", "revised", "replaced", "earlier"],
  hostel: ["hosteller", "mess", "curfew", "resident"],
};

const MONTH_MAP: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function tokenize(text: string): string[] {
  const clean = text.toLowerCase().replace(/[^a-z0-9%./-]+/g, " ");
  const raw = clean
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return Array.from(new Set(raw));
}

function expandQueryTokens(tokens: string[]): string[] {
  const out = new Set<string>(tokens);
  for (const token of tokens) {
    const normalized = token.replace(/-/g, "");
    out.add(normalized);
    for (const extra of SYNONYMS[token] ?? SYNONYMS[normalized] ?? []) {
      out.add(extra);
    }
  }
  return Array.from(out);
}

function splitSentences(text: string): string[] {
  return text
    .split(/\n+|(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12);
}

function scoreNoticeAgainstTokens(notice: Notice, expandedTokens: string[]): number {
  const haystack = [
    notice.circular_no,
    notice.title,
    notice.summary,
    notice.topic_tag.replace(/_/g, " "),
    notice.extracted_text,
  ]
    .join(" ")
    .toLowerCase();

  let score = 0;
  for (const token of expandedTokens) {
    if (haystack.includes(token)) {
      const titleHit =
        notice.title.toLowerCase().includes(token) ||
        notice.summary.toLowerCase().includes(token) ||
        notice.circular_no.toLowerCase().includes(token);
      score += titleHit ? 2.5 : 1;
    }
  }
  if (notice.status === "active" && score > 0) {
    score += 0.75;
  }
  return score;
}

function pickBestExcerpts(
  text: string,
  expandedTokens: string[],
  limit = 2
): string[] {
  const sentences = splitSentences(text).filter(
    (s) =>
      !/^(OFFICE OF|ACCOUNTS &|DEPARTMENT OF|DEAN OF|Subject:|Circular No:)/i.test(
        s
      )
  );
  const scored = sentences
    .map((s) => {
      const lower = s.toLowerCase();
      let hits = 0;
      for (const t of expandedTokens) {
        if (lower.includes(t)) hits += 1;
      }
      return { s, hits };
    })
    .filter((item) => item.hits > 0)
    .sort((a, b) => b.hits - a.hits);

  if (scored.length > 0) {
    return scored.slice(0, limit).map((x) => x.s);
  }
  return sentences.slice(0, limit);
}

function toIsoDate(rawDate: string, fallbackYear = "2026"): string | null {
  const iso = rawDate.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];

  const dmyText = rawDate.match(
    /\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t|tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s*(20\d{2})?\b/i
  );
  if (dmyText) {
    const day = dmyText[1].padStart(2, "0");
    const month = MONTH_MAP[dmyText[2].toLowerCase()];
    const year = dmyText[3] ?? fallbackYear;
    if (month) return `${year}-${month}-${day}`;
  }
  return null;
}

function extractDeadlineFromNoticeText(notice: Notice): ExtractedDeadlineSuggestion[] {
  const text = `${notice.summary}\n${notice.extracted_text}`;
  const timeMatch = text.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
  const dueTime = timeMatch ? timeMatch[1].toUpperCase() : "05:00 PM";
  const penaltySentence =
    splitSentences(notice.extracted_text).find((s) =>
      /fine|penalty|detention|no entry|0 internal|consequence/i.test(s)
    ) ?? "Refer official circular";

  const dateMatches = text.match(
    /\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*20\d{2}|20\d{2}-\d{2}-\d{2})\b/gi
  );
  if (!dateMatches || dateMatches.length === 0) return [];

  // Prefer the last/active target date mentioned in non-superseded text
  const candidateDates = dateMatches
    .map((d) => toIsoDate(d))
    .filter((d): d is string => Boolean(d) && d !== notice.effective_date);
  const dueDate =
    candidateDates[candidateDates.length - 1] ??
    toIsoDate(dateMatches[dateMatches.length - 1]);
  if (!dueDate) return [];

  return [
    {
      title: notice.title,
      due_date: dueDate,
      due_time: dueTime,
      penalty_impact: penaltySentence.slice(0, 140),
      circular_no: notice.circular_no,
    },
  ];
}

function buildSuggestedEmail(
  question: string,
  notice: Notice | null,
  profile: StudentProfile
): SuggestedEmail | null {
  const qLower = `${question} ${notice?.topic_tag ?? ""}`.toLowerCase();
  if (/medical|attendance|condonation|leave|65%|75%/.test(qLower)) {
    const circularNo = notice?.circular_no ?? "ACAD/2026/041";
    return {
      subject: `Application for Medical Attendance Condonation (${profile.branch} Sem ${profile.semester})`,
      recipient_role: `Head of Department (${profile.branch})`,
      body_template: `Respected Sir/Madam,\n\nWith reference to ${circularNo} (Clause 4.2 & 4.3), I am submitting my medical condonation request for Semester ${profile.semester} (${profile.branch}). Kindly find attached my registered medical practitioner certificate and diagnostic reports within the 5-working-day window.\n\nName: [Student Name]\nRoll No: [Roll No]\nSection: [Section]`,
      cited_circular_no: circularNo,
      cited_clause: "Clause 4.2 & 4.3",
    };
  }
  if (/fee|erp|form|fine/.test(qLower)) {
    const circularNo = notice?.circular_no ?? "FEE/2026/051";
    return {
      subject: `Request regarding End-Sem Examination Form & Fee (${profile.branch} Sem ${profile.semester})`,
      recipient_role: "Accounts & Examination Cell",
      body_template: `Respected Sir/Madam,\n\nReferring to official circular ${circularNo}, I am writing regarding my End-Semester Examination Form and fee verification on the ERP portal for Semester ${profile.semester} (${profile.branch}). Kindly assist with status confirmation before the deadline.\n\nName: [Student Name]\nRoll No: [Roll No]`,
      cited_circular_no: circularNo,
      cited_clause: null,
    };
  }
  if (/lab|dbms|python|practical|submission/.test(qLower)) {
    const circularNo = notice?.circular_no ?? "CSE/2026/072";
    return {
      subject: `Practical Record Verification Query - ${circularNo}`,
      recipient_role: `Faculty Mentor / Lab Coordinator (${profile.branch})`,
      body_template: `Respected Sir/Madam,\n\nWith reference to circular ${circularNo}, I would like to confirm mentor sign-off timing for my DBMS & Python practical records ahead of the Lab 304 submission deadline.\n\nName: [Student Name]\nRoll No: [Roll No]`,
      cited_circular_no: circularNo,
      cited_clause: null,
    };
  }
  return null;
}

export function answerCampusQuestionLocal(params: {
  question: string;
  profile: StudentProfile;
  notices: Notice[];
  attachment?: ParsedDocumentInput | null;
}): AskResponse {
  const { question, profile, notices, attachment } = params;
  const rawTokens = tokenize(question);
  const expandedTokens = expandQueryTokens(rawTokens);

  const scoredNotices = notices
    .map((notice) => ({
      notice,
      score: scoreNoticeAgainstTokens(notice, expandedTokens),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  const bestNoticeEntry = scoredNotices[0];
  const attachmentText = attachment?.textContent?.trim() ?? "";
  const isAttachmentSummaryAsk =
    Boolean(attachmentText) &&
    /attach|file|pdf|doc|summar|explain|read|what|rule|date|inside/i.test(
      question
    );
  const attachmentHits = attachmentText
    ? expandedTokens.filter((t) => attachmentText.toLowerCase().includes(t)).length
    : 0;

  const hasGroundedNotice =
    Boolean(bestNoticeEntry) && bestNoticeEntry.score >= 2.2;
  const hasGroundedAttachment =
    Boolean(attachmentText) && (isAttachmentSummaryAsk || attachmentHits >= 1);

  if (!hasGroundedNotice && !hasGroundedAttachment) {
    return {
      answer:
        "No official campus circular in the verified repository covers this query. Please verify directly with the Registrar or HOD Office before relying on unverified messages.",
      found_in_official_records: false,
      conflict_resolution: null,
      citations: [],
      extracted_deadlines: [],
      suggested_email: null,
      engine_used: "unibrief-local",
    };
  }

  const activeTop =
    scoredNotices.find(
      (e) => e.notice.status === "active" && e.score >= 2.2
    )?.notice ??
    (hasGroundedNotice ? bestNoticeEntry.notice : null);

  // Detect superseded vs active circular on the same topic
  let conflictResolution: ConflictResolution | null = null;
  const citations: AskCitation[] = [];

  if (activeTop) {
    const supersededSibling = notices.find(
      (n) =>
        n.status === "superseded" &&
        (n.superseded_by_id === activeTop.id || n.topic_tag === activeTop.topic_tag)
    );

    if (supersededSibling) {
      conflictResolution = {
        detected: true,
        topic_tag: activeTop.topic_tag,
        superseded_circular_no: supersededSibling.circular_no,
        superseded_rule: supersededSibling.summary.slice(0, 150),
        active_circular_no: activeTop.circular_no,
        active_rule: activeTop.summary.slice(0, 150),
        note: `${activeTop.circular_no} (${activeTop.effective_date}) supersedes ${supersededSibling.circular_no}.`,
      };
    }

    const firstRef = activeTop.page_references[0];
    citations.push({
      notice_id: activeTop.id,
      circular_no: activeTop.circular_no,
      title: activeTop.title,
      page: firstRef?.page ?? 1,
      excerpt: firstRef?.excerpt ?? activeTop.summary,
      status: activeTop.status,
      effective_date: activeTop.effective_date,
    });

    if (supersededSibling) {
      const oldRef = supersededSibling.page_references[0];
      citations.push({
        notice_id: supersededSibling.id,
        circular_no: supersededSibling.circular_no,
        title: supersededSibling.title,
        page: oldRef?.page ?? 1,
        excerpt: oldRef?.excerpt ?? supersededSibling.summary,
        status: supersededSibling.status,
        effective_date: supersededSibling.effective_date,
      });
    }
  }

  const answerParts: string[] = [];
  if (activeTop) {
    const excerpts = pickBestExcerpts(
      activeTop.extracted_text,
      expandedTokens,
      2
    );
    answerParts.push(
      `According to active official circular ${activeTop.circular_no} (${activeTop.effective_date}): ${activeTop.summary}`
    );
    if (excerpts.length > 0) {
      answerParts.push(excerpts.join(" "));
    }
  }

  if (hasGroundedAttachment && attachment) {
    const docExcerpts = pickBestExcerpts(attachmentText, expandedTokens, 2);
    answerParts.push(
      `From your attached document (${attachment.fileName}): ${
        docExcerpts.length > 0
          ? docExcerpts.join(" ")
          : attachmentText.slice(0, 320)
      }`
    );
  }

  return {
    answer: answerParts.join("\n\n"),
    found_in_official_records: true,
    conflict_resolution: conflictResolution,
    citations,
    extracted_deadlines: activeTop
      ? extractDeadlineFromNoticeText(activeTop)
      : [],
    suggested_email: buildSuggestedEmail(question, activeTop, profile),
    engine_used: "unibrief-local",
  };
}

export function verifyCampusRumorLocal(params: {
  claim: string;
  notices: Notice[];
}): VerifyRumorResponse {
  const { claim, notices } = params;
  const rawTokens = tokenize(claim);
  const expandedTokens = expandQueryTokens(rawTokens);

  const scored = notices
    .map((notice) => ({
      notice,
      score: scoreNoticeAgainstTokens(notice, expandedTokens),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Extract explicit dates or percentages mentioned in the claim
  const claimDates =
    claim.match(
      /\b\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\b/gi
    ) ?? [];
  const claimPercents = claim.match(/\b\d{2,3}%\b/g) ?? [];

  const topActive = scored.find((s) => s.notice.status === "active")?.notice;
  const topSuperseded = notices.find(
    (n) =>
      n.status === "superseded" &&
      (scoreNoticeAgainstTokens(n, expandedTokens) >= 2 ||
        (topActive &&
          (n.superseded_by_id === topActive.id ||
            n.topic_tag === topActive.topic_tag)))
  );

  // Detect stale date / superseded claim (e.g. "28 Nov" when EXAM/2026/088 is superseded by EXAM/2026/104)
  if (topSuperseded && claimDates.length > 0) {
    const oldTextLower = topSuperseded.extracted_text.toLowerCase();
    const activeSentences = splitSentences(topActive?.extracted_text ?? "").map(
      (s) => s.toLowerCase()
    );
    const mentionsOldDate = claimDates.some((d) => {
      const needle = d.toLowerCase();
      if (!oldTextLower.includes(needle)) return false;
      const activeMentions = activeSentences.filter((s) => s.includes(needle));
      if (activeMentions.length === 0) return true;
      return activeMentions.every((s) =>
        /originally|earlier|vide|supersedes|shifted|postponed|extended|instead of/.test(
          s
        )
      );
    });
    if (mentionsOldDate && topActive) {
      return {
        verdict: "OUTDATED",
        headline: `Outdated schedule (${topSuperseded.circular_no} was superseded)`,
        explanation: `This claim relies on outdated circular ${topSuperseded.circular_no}. Active circular ${topActive.circular_no} (${topActive.effective_date}) overrides it: ${topActive.summary}`,
        active_circular_ref: topActive.circular_no,
        outdated_circular_ref: topSuperseded.circular_no,
        citations: [
          {
            notice_id: topActive.id,
            circular_no: topActive.circular_no,
            title: topActive.title,
            page: topActive.page_references[0]?.page ?? 1,
            excerpt: topActive.page_references[0]?.excerpt ?? topActive.summary,
            status: topActive.status,
            effective_date: topActive.effective_date,
          },
          {
            notice_id: topSuperseded.id,
            circular_no: topSuperseded.circular_no,
            title: topSuperseded.title,
            page: topSuperseded.page_references[0]?.page ?? 1,
            excerpt:
              topSuperseded.page_references[0]?.excerpt ??
              topSuperseded.summary,
            status: topSuperseded.status,
            effective_date: topSuperseded.effective_date,
          },
        ],
        engine_used: "unibrief-local",
      };
    }
  }

  const bestScore = scored[0]?.score ?? 0;
  const threshold = claimPercents.length > 0 || claimDates.length > 0 ? 2.5 : 3.5;

  if (!topActive || bestScore < threshold) {
    return {
      verdict: "UNVERIFIED_RUMOR",
      headline: "Unverified claim — no official circular found",
      explanation:
        "No active or archived circular in the official repository supports this forwarded claim. Do not rely on WhatsApp forwards without an official Registrar or Dean notice.",
      active_circular_ref: null,
      outdated_circular_ref: null,
      citations: [],
      engine_used: "unibrief-local",
    };
  }

  const activeTextLower = topActive.extracted_text.toLowerCase();
  const hasMatchingPercent =
    claimPercents.length === 0 ||
    claimPercents.some((p) => activeTextLower.includes(p.toLowerCase()));
  const hasMatchingDate =
    claimDates.length === 0 ||
    claimDates.some((d) => activeTextLower.includes(d.toLowerCase()));

  const verdict: RumorVerdict =
    hasMatchingPercent && hasMatchingDate ? "VERIFIED" : "UNVERIFIED_RUMOR";

  return {
    verdict,
    headline:
      verdict === "VERIFIED"
        ? `Backed by ${topActive.circular_no} (with official conditions)`
        : `Details differ from active circular ${topActive.circular_no}`,
    explanation: `Active circular ${topActive.circular_no} (${topActive.effective_date}) states: ${topActive.summary}`,
    active_circular_ref: topActive.circular_no,
    outdated_circular_ref: topSuperseded?.circular_no ?? null,
    citations: [
      {
        notice_id: topActive.id,
        circular_no: topActive.circular_no,
        title: topActive.title,
        page: topActive.page_references[0]?.page ?? 1,
        excerpt: topActive.page_references[0]?.excerpt ?? topActive.summary,
        status: topActive.status,
        effective_date: topActive.effective_date,
      },
    ],
    engine_used: "unibrief-local",
  };
}

function inferTopicTag(text: string, existingTopics: string[]): string {
  const lower = text.toLowerCase();
  const checks: Array<{ tag: string; pattern: RegExp }> = [
    { tag: "fee_deadline", pattern: /\bfee\b|\bfine\b|\berp\b|tuition/i },
    { tag: "midsem_schedule", pattern: /mid-?sem|mid\s+semester|exam\s+schedule/i },
    { tag: "lab_submission", pattern: /\blab\b|practical\s+file|submission/i },
    { tag: "medical_leave", pattern: /medical|attendance|condonation/i },
    { tag: "hostel_curfew", pattern: /hostel|curfew|mess\s+dues/i },
  ];
  for (const check of checks) {
    if (check.pattern.test(lower)) {
      const matchedExisting = existingTopics.find((t) => t === check.tag);
      return matchedExisting ?? check.tag;
    }
  }
  return "general_notice";
}

export function extractNoticeFromDocumentLocal(
  doc: ParsedDocumentInput,
  existingTopics: string[]
): { payload: LocalExtractedIngestPayload; engineUsed: string } {
  const text = doc.textContent?.trim() ?? "";
  const todayIso = new Date().toISOString().slice(0, 10);

  const circularMatch = text.match(
    /(?:Circular\s*(?:No|Ref)?\.?\s*[:#-]?\s*)?([A-Z]{2,10}\/\d{4}\/\d{2,5})/i
  );
  const circularNo = circularMatch
    ? circularMatch[1].toUpperCase()
    : `NOTICE/${new Date().getFullYear()}/${Math.floor(100 + Math.random() * 900)}`;

  const subjectMatch = text.match(/Subject\s*:\s*([^\n]+)/i);
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const title = subjectMatch
    ? subjectMatch[1].trim()
    : lines[0]?.slice(0, 120) || doc.fileName;

  const explicitDateMatch = text.match(
    /Date\s*:\s*([^\n|]+)/i
  );
  const effectiveDate =
    (explicitDateMatch ? toIsoDate(explicitDateMatch[1]) : null) ??
    toIsoDate(text) ??
    todayIso;

  const supersedesPrevious =
    /supersedes|replaces|revised|extended|postponed|modification\s+of/i.test(
      text
    );

  const topicTag = inferTopicTag(text, existingTopics);

  const branchList = ["CSE", "AIML", "ECE", "ME"].filter((b) =>
    new RegExp(`\\b${b}\\b`, "i").test(text)
  );
  const targetBranches =
    /all\s+branches/i.test(text) || branchList.length === 0
      ? ["All"]
      : branchList;

  const semMatches = Array.from(text.matchAll(/\bSem(?:ester)?\s*(\d)\b/gi))
    .map((m) => Number(m[1]))
    .filter((n) => n >= 1 && n <= 8);
  const targetSemesters =
    /sem\s*1\s*[-–]\s*8|all\s+semesters/i.test(text) || semMatches.length === 0
      ? [1, 2, 3, 4, 5, 6, 7, 8]
      : Array.from(new Set(semMatches));

  const audienceType: AudienceType =
    /\bhosteller/i.test(text) && !/day\s+scholar/i.test(text)
      ? "hosteller"
      : /day\s+scholar/i.test(text) && !/\bhosteller/i.test(text)
        ? "day_scholar"
        : "all";

  const sentences = splitSentences(text);
  const summary =
    sentences
      .filter((s) => !/^(OFFICE OF|ACCOUNTS|Subject:|Circular No:)/i.test(s))
      .slice(0, 2)
      .join(" ") || text.slice(0, 240);

  const pageReferences: PageReference[] =
    doc.pageTexts && doc.pageTexts.length > 0
      ? doc.pageTexts
          .map((pageText, i) => ({
            page: i + 1,
            excerpt: pageText.trim().slice(0, 260),
          }))
          .filter((r) => r.excerpt.length > 0)
      : [{ page: 1, excerpt: summary.slice(0, 260) }];

  const allDates =
    text.match(
      /\b(?:\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s*20\d{2}|20\d{2}-\d{2}-\d{2})\b/gi
    ) ?? [];
  const deadlineIsoDates = Array.from(
    new Set(
      allDates
        .map((d) => toIsoDate(d))
        .filter((d): d is string => Boolean(d) && d !== effectiveDate)
    )
  );
  const targetDeadlineIso =
    deadlineIsoDates[deadlineIsoDates.length - 1] ?? null;
  const dueTimeMatch = text.match(/\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b/i);
  const penaltyLine =
    sentences.find((s) => /fine|penalty|detention|0\s+internal/i.test(s)) ??
    "Refer official circular";

  const deadlines = targetDeadlineIso
    ? [
        {
          title: title.slice(0, 100),
          due_date: targetDeadlineIso,
          due_time: dueTimeMatch ? dueTimeMatch[1].toUpperCase() : "05:00 PM",
          penalty_impact: penaltyLine.slice(0, 160),
          urgency: (/fine|detention|mandatory/i.test(penaltyLine)
            ? "critical"
            : "high") as UrgencyLevel,
          action_url: null,
        },
      ]
    : [];

  return {
    engineUsed: "unibrief-local",
    payload: {
      circular_no: circularNo,
      title,
      summary,
      extracted_text: text,
      page_references: pageReferences,
      topic_tag: topicTag,
      effective_date: effectiveDate,
      supersedes_previous: supersedesPrevious,
      target_branches: targetBranches,
      target_semesters: targetSemesters,
      audience_type: audienceType,
      policy_rules: null,
      deadlines,
    },
  };
}
