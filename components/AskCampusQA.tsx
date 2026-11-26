"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Loader2,
  Mail,
  Paperclip,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { downloadIcsFile } from "@/lib/ics";
import type {
  AskResponse,
  Notice,
  StudentProfile,
  SuggestedEmail,
} from "@/types/campus";

interface ChatTurn {
  id: string;
  question: string;
  attachmentName?: string;
  response?: AskResponse;
  error?: string;
  loading?: boolean;
}

interface AskCampusQAProps {
  notices: Notice[];
  profile: StudentProfile;
  onInspectCircular: (noticeId: string) => void;
  onDraftEmail: (email: SuggestedEmail) => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}

const STARTER_QUESTIONS = [
  "When is my Mid-Sem exam starting?",
  "Is there any late fee deadline coming up?",
  "How do I apply for medical leave if attendance is below 75%?",
  "What is the DBMS lab submission deadline?",
];

export function AskCampusQA({
  notices,
  profile,
  onInspectCircular,
  onDraftEmail,
  onToast,
}: AskCampusQAProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const turnSeqRef = useRef(0);

  const firstActiveNotice =
    notices.find((n) => n.status === "active") ?? notices[0] ?? null;

  async function submitQuestion(rawQ: string) {
    const cleanQ = rawQ.trim();
    if (!cleanQ || isSubmitting) return;

    turnSeqRef.current += 1;
    const turnId = `turn-${turnSeqRef.current}`;
    const fileToSend = attachedFile;

    setTurns((prev) => [
      ...prev,
      {
        id: turnId,
        question: cleanQ,
        attachmentName: fileToSend?.name,
        loading: true,
      },
    ]);
    setQuestion("");
    setAttachedFile(null);
    setIsSubmitting(true);

    try {
      let res: Response;
      if (fileToSend) {
        const fd = new FormData();
        fd.append("question", cleanQ);
        fd.append("profile", JSON.stringify(profile));
        fd.append("attachment", fileToSend);
        res = await fetch("/api/ask", {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch("/api/ask", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question: cleanQ, profile }),
        });
      }

      const data = (await res.json()) as AskResponse & {
        error?: string;
      };

      if (!res.ok) {
        const errMsg = data.error || "Failed to fetch grounded answer.";
        onToast(errMsg, "error");
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId
              ? { ...t, loading: false, error: errMsg }
              : t
          )
        );
        return;
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, loading: false, response: data } : t
        )
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Network error calling /api/ask.";
      onToast(msg, "error");
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, loading: false, error: msg } : t
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {/* Top Quiet Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            UniBrief AI
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Calm, citation-backed answers for {profile.branch} Sem{" "}
            {profile.semester}
          </p>
        </div>
        {firstActiveNotice && (
          <button
            type="button"
            onClick={() => onInspectCircular(firstActiveNotice.id)}
            className="glass-card inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-700"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            Browse Circulars ({notices.length})
          </button>
        )}
      </div>

      {/* Main Calm Glass Conversation Container */}
      <section className="glass-panel flex min-h-[470px] flex-col justify-between rounded-3xl p-5 sm:p-7">
        <div className="flex-1 space-y-5 overflow-y-auto pb-6">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-800 shadow-xs ring-1 ring-white">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
                What would you like to verify?
              </h2>
              <p className="mt-1.5 max-w-md text-xs leading-relaxed text-slate-500">
                Click a question below or attach any personal notice. Source
                proof opens cleanly on demand so your workspace stays uncluttered.
              </p>

              <div className="mt-6 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
                {STARTER_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => submitQuestion(q)}
                    className="glass-card flex cursor-pointer items-center justify-between gap-2 rounded-2xl px-4 py-3.5 text-left text-xs font-medium text-slate-800 transition disabled:opacity-50"
                  >
                    <span className="leading-relaxed">{q}</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-3.5">
                {/* User Query */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-3xl rounded-tr-md bg-slate-900 px-4 py-3 text-sm text-white shadow-sm">
                    <p>{turn.question}</p>
                    {turn.attachmentName && (
                      <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-[11px]">
                        <Paperclip className="h-3 w-3" aria-hidden="true" />
                        {turn.attachmentName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Loading */}
                {turn.loading && (
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-xs font-medium text-slate-600">
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin text-slate-700"
                      aria-hidden="true"
                    />
                    Checking verified campus records...
                  </div>
                )}

                {/* Error */}
                {turn.error && (
                  <div className="rounded-2xl bg-rose-50/90 p-4 text-xs text-rose-800 ring-1 ring-rose-200">
                    {turn.error}
                  </div>
                )}

                {/* Assistant Answer */}
                {turn.response && (
                  <div className="space-y-3.5 rounded-3xl bg-white/75 p-5 ring-1 ring-white/90">
                    {/* Revision Diff (Clean Side-by-Side) */}
                    {turn.response.conflict_resolution?.detected && (
                      <div className="rounded-2xl bg-slate-50/80 p-3.5 ring-1 ring-slate-200/70">
                        <div className="mb-2 flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800">
                            Revision Detected
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-medium text-emerald-800">
                            <CheckCircle2
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            Override Verified
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-xl bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
                            <span className="font-mono font-semibold">
                              {turn.response.conflict_resolution.superseded_circular_no}
                            </span>
                            <p className="mt-0.5 line-through opacity-75">
                              {turn.response.conflict_resolution.superseded_rule}
                            </p>
                          </div>
                          <div className="rounded-xl bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900">
                            <span className="font-mono font-semibold">
                              {turn.response.conflict_resolution.active_circular_no}
                            </span>
                            <p className="mt-0.5 font-medium">
                              {turn.response.conflict_resolution.active_rule}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Hallucination Shield or Clean Prose */}
                    {!turn.response.found_in_official_records ? (
                      <div className="flex items-start gap-3 rounded-2xl bg-amber-50/85 p-4 text-amber-950 ring-1 ring-amber-200/80">
                        <ShieldAlert
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-700"
                          aria-hidden="true"
                        />
                        <div className="text-xs leading-relaxed">
                          <p className="font-semibold">
                            No Official Record Found
                          </p>
                          <p className="mt-1 text-amber-900">
                            {turn.response.answer}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                          {turn.response.answer}
                        </p>
                        {turn.attachmentName &&
                          turn.response.citations.length === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-800">
                              <Paperclip
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              Grounded in {turn.attachmentName}
                            </span>
                          )}
                      </div>
                    )}

                    {/* Source Chips + Action Pills */}
                    {(turn.response.citations.length > 0 ||
                      turn.response.extracted_deadlines.length > 0 ||
                      turn.response.suggested_email) && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {turn.response.citations.map((cit, idx) => (
                          <button
                            key={`${cit.notice_id}-${cit.page}-${idx}`}
                            type="button"
                            onClick={() => onInspectCircular(cit.notice_id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-slate-900/6 px-3 py-1 font-mono text-[11px] font-semibold text-[#1E3A5F] transition hover:bg-slate-900 hover:text-white"
                          >
                            {cit.circular_no} · p.{cit.page}
                          </button>
                        ))}

                        {turn.response.extracted_deadlines.map((dl, idx) => (
                          <button
                            key={`${dl.circular_no}-${idx}`}
                            type="button"
                            onClick={() =>
                              downloadIcsFile({
                                title: dl.title,
                                date: dl.due_date,
                                time: dl.due_time,
                                circularNo: dl.circular_no,
                                description: `Penalty: ${dl.penalty_impact}`,
                              })
                            }
                            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-900 hover:text-white"
                          >
                            <CalendarPlus
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            .ics ({dl.due_date})
                          </button>
                        ))}

                        {turn.response.suggested_email && (
                          <button
                            type="button"
                            onClick={() =>
                              onDraftEmail(turn.response!.suggested_email!)
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 px-3.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
                          >
                            <Mail className="h-3 w-3" aria-hidden="true" />
                            Draft Mail
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Calm Floating Pill Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="space-y-2"
        >
          {attachedFile && (
            <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs ring-1 ring-slate-200">
              <Paperclip className="h-3 w-3 text-slate-600" aria-hidden="true" />
              <span className="font-mono text-slate-700">
                {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                aria-label="Remove attached document"
                className="cursor-pointer rounded-full p-0.5 text-slate-400 hover:text-slate-900"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-full bg-white/85 p-1.5 shadow-sm ring-1 ring-white transition focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-300">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setAttachedFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach personal PDF, DOCX, TXT, or notice image"
              aria-label="Attach PDF, DOCX, TXT, or notice photo"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Paperclip className="h-4 w-4" aria-hidden="true" />
            </button>

            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                }
              }}
              placeholder="Ask about exams, fines, medical leave, or attach a file..."
              aria-label="Question for UniBrief"
              className="h-9 flex-1 bg-transparent px-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting || !question.trim()}
              aria-label="Submit question"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
