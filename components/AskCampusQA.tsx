"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUp,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FileText,
  FlaskConical,
  IndianRupee,
  Loader2,
  Mail,
  Paperclip,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  X,
} from "lucide-react";
import { downloadIcsFile } from "@/lib/ics";
import { filterNoticesForProfile } from "@/lib/profile";
import type {
  AskCitation,
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
  onDraftEmail: (email: SuggestedEmail) => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}

const STARTER_CARDS = [
  {
    q: "When is my Mid-Sem exam starting?",
    tag: "Schedule & Conflict Check",
    icon: CalendarClock,
  },
  {
    q: "Is there any late fee deadline coming up?",
    tag: "Fines & ERP Deadlines",
    icon: IndianRupee,
  },
  {
    q: "How do I apply for medical leave if attendance is below 75%?",
    tag: "Ordinance & Appeal Mail",
    icon: Stethoscope,
  },
  {
    q: "What is the DBMS lab submission deadline?",
    tag: "Department Lab Rules",
    icon: FlaskConical,
  },
];

export function AskCampusQA({
  notices,
  profile,
  onDraftEmail,
  onToast,
}: AskCampusQAProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<AskCitation | null>(
    null
  );
  const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const turnSeqRef = useRef(0);

  const profileNotices = filterNoticesForProfile(notices, profile);

  const inspectedNotice =
    notices.find(
      (n) => n.id === (selectedCitation?.notice_id ?? selectedNoticeId)
    ) ??
    profileNotices[0] ??
    notices[0] ??
    null;

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
        res = await fetch("/api/ask", { method: "POST", body: fd });
      } else {
        res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: cleanQ, profile }),
        });
      }

      const data = (await res.json()) as AskResponse & {
        error?: string;
        code?: string;
      };

      if (!res.ok) {
        const errMsg = data.error || "Failed to fetch grounded answer.";
        onToast(errMsg, "error");
        setTurns((prev) =>
          prev.map((t) =>
            t.id === turnId ? { ...t, loading: false, error: errMsg } : t
          )
        );
        return;
      }

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId ? { ...t, loading: false, response: data } : t
        )
      );

      if (data.citations.length > 0) {
        setSelectedCitation(data.citations[0]);
        setSelectedNoticeId(data.citations[0].notice_id);
      }
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
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Pane: Perplexity-Style Q&A Workbench (7 cols) */}
      <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-7">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-6 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-zinc-900">
              AskCampus Q&amp;A
            </h1>
            <p className="text-xs text-zinc-500">
              Verified answers for{" "}
              <span className="font-semibold text-zinc-800">
                {profile.branch} · Sem {profile.semester} · {profile.residence}
              </span>
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
            <Sparkles className="h-3.5 w-3.5 text-[#1E3A5F]" aria-hidden="true" />
            Zero-Hallucination Shield
          </span>
        </div>

        {/* Thread */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 min-h-[420px] max-h-[640px]">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col justify-center py-4">
              <div className="text-center">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
                  What do you need from campus records?
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-zinc-500">
                  Every reply cites exact circular numbers, detects superseded
                  dates automatically, or lets you attach a personal PDF/DOCX/TXT.
                </p>
              </div>

              {/* 2x2 Starter Cards */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {STARTER_CARDS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.q}
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => submitQuestion(item.q)}
                      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-left transition-all duration-150 hover:border-zinc-300 hover:bg-white hover:shadow-xs disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#1E3A5F]">
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.tag}
                        </span>
                        <ArrowRight
                          className="h-3.5 w-3.5 text-zinc-400 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-700"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="mt-2 text-sm font-medium leading-snug text-zinc-800">
                        {item.q}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-4">
                {/* User Query Bubble */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#0F172A] px-4 py-3 text-sm text-white shadow-xs">
                    <p>{turn.question}</p>
                    {turn.attachmentName && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 font-mono text-[11px]">
                        <Paperclip className="h-3 w-3" aria-hidden="true" />
                        {turn.attachmentName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Loading */}
                {turn.loading && (
                  <div className="inline-flex items-center gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-medium text-zinc-600">
                    <Loader2
                      className="h-4 w-4 animate-spin text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    Checking official circulars &amp; conflict history...
                  </div>
                )}

                {/* Error */}
                {turn.error && (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800">
                    <strong>Request failed:</strong> {turn.error}
                  </div>
                )}

                {/* Answer Card */}
                {turn.response && (
                  <div className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5">
                    {/* Conflict Diff Comparison */}
                    {turn.response.conflict_resolution?.detected && (
                      <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5">
                          <span className="text-xs font-semibold text-zinc-900">
                            Circular Revision Detected
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                            <CheckCircle2
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            Override Verified
                          </span>
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs text-amber-900">
                            <div className="font-mono font-semibold">
                              Old: {turn.response.conflict_resolution.superseded_circular_no}
                            </div>
                            <p className="mt-1 line-through opacity-80">
                              {turn.response.conflict_resolution.superseded_rule}
                            </p>
                          </div>
                          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/70 p-3 text-xs text-emerald-900">
                            <div className="font-mono font-semibold">
                              Active: {turn.response.conflict_resolution.active_circular_no}
                            </div>
                            <p className="mt-1 font-medium">
                              {turn.response.conflict_resolution.active_rule}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Answer Text or Hallucination Shield */}
                    {!turn.response.found_in_official_records ? (
                      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
                        <ShieldAlert
                          className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold">
                            No Official Campus Record Found (Hallucination Shield)
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-amber-900">
                            {turn.response.answer}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="text-sm leading-relaxed text-zinc-800 whitespace-pre-line">
                          {turn.response.answer}
                        </div>
                        {turn.attachmentName &&
                          turn.response.citations.length === 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-700">
                              <Paperclip className="h-3 w-3" aria-hidden="true" />
                              Grounded in attached file: {turn.attachmentName}
                            </span>
                          )}
                      </div>
                    )}

                    {/* Citation Pills */}
                    {turn.response.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs font-medium text-zinc-500">
                          Sources:
                        </span>
                        {turn.response.citations.map((cit, idx) => {
                          const isSelected =
                            selectedCitation?.notice_id === cit.notice_id &&
                            selectedCitation?.page === cit.page;
                          return (
                            <button
                              key={`${cit.notice_id}-${cit.page}-${idx}`}
                              type="button"
                              onClick={() => {
                                setSelectedCitation(cit);
                                setSelectedNoticeId(cit.notice_id);
                              }}
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-medium transition ${
                                isSelected
                                  ? "border-[#0F172A] bg-[#0F172A] text-white"
                                  : "border-zinc-200 bg-white text-[#1E3A5F] hover:border-zinc-400"
                              }`}
                            >
                              {cit.circular_no} · p.{cit.page}
                              <ArrowRight
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Action Bar */}
                    {(turn.response.extracted_deadlines.length > 0 ||
                      turn.response.suggested_email) && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200/80 pt-3">
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
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-900"
                          >
                            <CalendarPlus
                              className="h-3.5 w-3.5 text-[#1E3A5F]"
                              aria-hidden="true"
                            />
                            Add .ics ({dl.due_date})
                          </button>
                        ))}

                        {turn.response.suggested_email && (
                          <button
                            type="button"
                            onClick={() =>
                              onDraftEmail(turn.response!.suggested_email!)
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#0F172A] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                          >
                            <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                            Draft Official Mail
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

        {/* Modern Floating Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="border-t border-zinc-100 p-4"
        >
          {attachedFile && (
            <div className="mb-2.5 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono text-[#1E3A5F]">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                Attached: {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                aria-label="Remove attached document"
                className="cursor-pointer rounded-full p-0.5 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-1.5 transition focus-within:border-zinc-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-zinc-100">
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
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-zinc-500 transition hover:bg-zinc-200/60 hover:text-zinc-900"
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
              placeholder="Ask about exams, fines, medical leave, or attach a notice..."
              aria-label="Question for AskCampus"
              className="h-9 flex-1 bg-transparent px-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            />

            <button
              type="submit"
              disabled={isSubmitting || !question.trim()}
              aria-label="Submit question"
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#0F172A] text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
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

      {/* Right Pane: Document Proof Inspector (5 cols) */}
      <aside className="flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-5">
        <div className="border-b border-zinc-100 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold tracking-tight text-zinc-900">
              Source Proof Inspector
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
              {profileNotices.length} circulars
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {notices.slice(0, 8).map((n) => {
              const isCurrent = inspectedNotice?.id === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    setSelectedNoticeId(n.id);
                    setSelectedCitation(null);
                  }}
                  className={`cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium transition ${
                    isCurrent
                      ? "border-[#0F172A] bg-[#0F172A] text-white"
                      : n.status === "superseded"
                        ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-400"
                  }`}
                >
                  {n.circular_no}
                </button>
              );
            })}
          </div>
        </div>

        {inspectedNotice ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[640px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F]">
                {inspectedNotice.circular_no}
              </span>
              {inspectedNotice.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Superseded
                </span>
              )}
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {inspectedNotice.effective_date}
              </span>
            </div>

            <div>
              <h3 className="text-base font-semibold text-zinc-900">
                {inspectedNotice.title}
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                {inspectedNotice.target_branches.join(", ")} · Sem{" "}
                {inspectedNotice.target_semesters.length === 8
                  ? "1–8"
                  : inspectedNotice.target_semesters.join(", ")}{" "}
                · {inspectedNotice.audience_type.replace("_", " ")}
              </p>
            </div>

            {selectedCitation &&
            selectedCitation.notice_id === inspectedNotice.id ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                <div className="font-mono text-xs font-semibold text-amber-900">
                  Highlighted Excerpt · Page {selectedCitation.page}
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-900">
                  <mark className="rounded bg-amber-200/80 px-1 text-zinc-950">
                    {selectedCitation.excerpt}
                  </mark>
                </p>
              </div>
            ) : (
              inspectedNotice.page_references.map((ref, idx) => (
                <div
                  key={`${ref.page}-${idx}`}
                  className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5"
                >
                  <div className="font-mono text-xs font-semibold text-[#1E3A5F]">
                    Page {ref.page}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-700">
                    &ldquo;{ref.excerpt}&rdquo;
                  </p>
                </div>
              ))
            )}

            {inspectedNotice.file_data_url &&
              inspectedNotice.file_mime.startsWith("image/") && (
                <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inspectedNotice.file_data_url}
                    alt={`Circular ${inspectedNotice.circular_no}`}
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              )}

            <div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span className="font-semibold text-zinc-700">
                  Verbatim Circular Text
                </span>
                <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {inspectedNotice.file_name}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-700">
                {inspectedNotice.extracted_text}
              </pre>
            </div>
          </div>
        ) : (
          <p className="p-6 text-sm text-zinc-500">
            No official circulars loaded yet.
          </p>
        )}
      </aside>
    </div>
  );
}
