"use client";

import { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  Send,
  ShieldAlert,
  Sparkles,
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

const STARTER_QUESTIONS = [
  "When is my Mid-Sem exam starting?",
  "Is there any late fee deadline coming up?",
  "How do I apply for medical leave if attendance is below 75%?",
  "What is the DBMS lab submission deadline?",
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
      (n) =>
        n.id === (selectedCitation?.notice_id ?? selectedNoticeId)
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
      {/* Left Pane: Chat Workbench (7 cols) */}
      <section className="flex flex-col rounded-sm border border-[#CBD5E1] bg-white lg:col-span-7">
        {/* Workbench Header */}
        <div className="border-b border-[#CBD5E1] bg-[#F7F8FA] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="font-serif text-xl font-semibold text-[#0F172A]">
                AskCampus Q&amp;A Workbench
              </h1>
              <p className="mt-0.5 text-xs text-[#475569]">
                Grounded strictly in official circulars matching{" "}
                <span className="font-semibold text-[#0F172A]">
                  {profile.branch} · Sem {profile.semester} ·{" "}
                  {profile.residence}
                </span>
                .
              </p>
            </div>
            <span className="rounded-sm border border-[#CBD5E1] bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-[#1E3A5F]">
              Zero-Hallucination Shield
            </span>
          </div>

          {/* 4 Starter Questions */}
          <div className="mt-3 flex flex-wrap gap-2">
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isSubmitting}
                onClick={() => submitQuestion(q)}
                className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-left text-xs font-medium text-[#1E3A5F] transition-colors hover:border-[#1E3A5F] hover:bg-[#EFF2F6] disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Conversation Thread */}
        <div className="flex-1 space-y-5 p-5 min-h-[380px] max-h-[620px] overflow-y-auto">
          {turns.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center py-12 text-center">
              <Sparkles
                className="h-7 w-7 text-[#1E3A5F]"
                aria-hidden="true"
              />
              <h2 className="mt-3 font-serif text-lg font-semibold text-[#0F172A]">
                Ask any academic, exam, fee, or hostel rule question
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#475569]">
                Click a starter prompt above or attach a personal PDF/DOCX/TXT/Image
                notice with the paperclip icon. Every claim links directly to its
                exact circular page and verbatim clause on the right.
              </p>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className="space-y-3">
                {/* User Query */}
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-sm border border-[#1E3A5F] bg-[#1E3A5F] px-4 py-2.5 text-sm text-white">
                    <p>{turn.question}</p>
                    {turn.attachmentName && (
                      <p className="mt-1 inline-flex items-center gap-1 rounded-xs bg-white/15 px-2 py-0.5 font-mono text-[11px]">
                        <Paperclip className="h-3 w-3" aria-hidden="true" />
                        {turn.attachmentName}
                      </p>
                    )}
                  </div>
                </div>

                {/* Loading */}
                {turn.loading && (
                  <div className="flex items-center gap-2 rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-4 py-3 text-xs font-medium text-[#334155]">
                    <Loader2
                      className="h-4 w-4 animate-spin text-[#1E3A5F]"
                      aria-hidden="true"
                    />
                    Cross-checking active and superseded circulars for{" "}
                    {profile.branch} Sem {profile.semester}...
                  </div>
                )}

                {/* Error */}
                {turn.error && (
                  <div className="rounded-sm border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs text-[#991B1B]">
                    <strong>Request failed:</strong> {turn.error}
                  </div>
                )}

                {/* Answer Card */}
                {turn.response && (
                  <div className="space-y-3 rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-4">
                    {/* Conflict Diff Card */}
                    {turn.response.conflict_resolution?.detected && (
                      <div className="rounded-sm border border-[#CBD5E1] bg-white p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                          <span className="text-xs font-semibold text-[#0F172A]">
                            Circular Revision Detected
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#166534]">
                            <CheckCircle2
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                            Override Verified
                          </span>
                        </div>
                        <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-sm border border-[#FCD34D] bg-[#FFFBEB] p-2.5 text-xs text-[#92400E]">
                            <div className="font-mono font-semibold">
                              Old: {turn.response.conflict_resolution.superseded_circular_no}
                            </div>
                            <p className="mt-1 line-through">
                              {turn.response.conflict_resolution.superseded_rule}
                            </p>
                          </div>
                          <div className="rounded-sm border border-[#86EFAC] bg-[#F0FDF4] p-2.5 text-xs text-[#166534]">
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

                    {/* Hallucination Shield */}
                    {!turn.response.found_in_official_records ? (
                      <div className="flex items-start gap-3 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] p-3.5 text-sm text-[#92400E]">
                        <ShieldAlert
                          className="mt-0.5 h-5 w-5 shrink-0"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="font-semibold">
                            No Official Campus Record Found (Hallucination Shield)
                          </p>
                          <p className="mt-1 text-xs leading-relaxed">
                            {turn.response.answer}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm leading-relaxed text-[#0F172A] whitespace-pre-line">
                          {turn.response.answer}
                        </div>
                        {turn.attachmentName &&
                          turn.response.citations.length === 0 && (
                            <span className="inline-flex items-center gap-1 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 font-mono text-[11px] font-medium text-[#166534]">
                              <Paperclip className="h-3 w-3" aria-hidden="true" />
                              Grounded in attached file: {turn.attachmentName}
                            </span>
                          )}
                      </div>
                    )}

                    {/* Clickable Citation Pills */}
                    {turn.response.citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#475569]">
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
                              className={`inline-flex cursor-pointer items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-xs font-medium transition-colors ${
                                isSelected
                                  ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                                  : "border-[#CBD5E1] bg-white text-[#1E3A5F] hover:border-[#1E3A5F]"
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

                    {/* Action Bar below Answer */}
                    {(turn.response.extracted_deadlines.length > 0 ||
                      turn.response.suggested_email) && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-[#E2E8F0] pt-3">
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
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[#1E3A5F] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white"
                          >
                            <CalendarPlus
                              className="h-3.5 w-3.5"
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
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-[#1E3A5F] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#162C49]"
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

        {/* Input Form with Paperclip Attachment */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="border-t border-[#CBD5E1] bg-[#F7F8FA] p-4"
        >
          {attachedFile && (
            <div className="mb-2 flex items-center justify-between rounded-sm border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono text-[#1E3A5F]">
                <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                Attached for one-off Q&amp;A: {attachedFile.name}
              </span>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                aria-label="Remove attached document"
                className="cursor-pointer text-[#475569] hover:text-[#991B1B]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
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
              className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-[#CBD5E1] bg-white text-[#334155] hover:border-[#1E3A5F] hover:text-[#1E3A5F]"
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
              placeholder="Ask about exam dates, late fines, medical leave, or attached PDF..."
              aria-label="Question for AskCampus"
              className="h-10 flex-1 rounded-sm border border-[#CBD5E1] bg-white px-3.5 text-sm text-[#0F172A] placeholder:text-[#64748B]"
            />

            <button
              type="submit"
              disabled={isSubmitting || !question.trim()}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-sm bg-[#1E3A5F] px-4 text-sm font-semibold text-white hover:bg-[#162C49] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Ask</span>
            </button>
          </div>
        </form>
      </section>

      {/* Right Pane: Source Proof Inspector (5 cols) */}
      <aside className="flex flex-col rounded-sm border border-[#CBD5E1] bg-white lg:col-span-5">
        <div className="border-b border-[#CBD5E1] bg-[#F7F8FA] px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold text-[#0F172A]">
              Citation Proof Inspector
            </h2>
            <span className="font-mono text-xs text-[#475569]">
              {profileNotices.length} profile circulars
            </span>
          </div>

          {/* Quick Circular Switcher Pills */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
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
                  className={`cursor-pointer rounded-sm border px-2 py-0.5 font-mono text-[11px] font-medium transition-colors ${
                    isCurrent
                      ? "border-[#1E3A5F] bg-[#1E3A5F] text-white"
                      : n.status === "superseded"
                        ? "border-[#FCD34D] bg-[#FFFBEB] text-[#92400E]"
                        : "border-[#CBD5E1] bg-white text-[#334155] hover:border-[#1E3A5F]"
                  }`}
                >
                  {n.circular_no}
                </button>
              );
            })}
          </div>
        </div>

        {inspectedNotice ? (
          <div className="flex-1 space-y-4 overflow-y-auto p-5 max-h-[620px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-2 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F]">
                {inspectedNotice.circular_no}
              </span>
              {inspectedNotice.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 text-xs font-medium text-[#166534]">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#92400E]">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Superseded
                </span>
              )}
              <span className="font-mono text-xs text-[#475569] tabular-nums">
                {inspectedNotice.effective_date}
              </span>
            </div>

            <div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                {inspectedNotice.title}
              </h3>
              <p className="mt-1 text-xs text-[#475569]">
                Target: {inspectedNotice.target_branches.join(", ")} · Sem{" "}
                {inspectedNotice.target_semesters.length === 8
                  ? "1–8"
                  : inspectedNotice.target_semesters.join(", ")}{" "}
                · {inspectedNotice.audience_type.replace("_", " ")}
              </p>
            </div>

            {/* Highlighted Verbatim Excerpt */}
            {selectedCitation &&
            selectedCitation.notice_id === inspectedNotice.id ? (
              <div className="rounded-sm border border-[#1E3A5F] border-l-4 bg-[#EFF2F6] p-3.5">
                <div className="font-mono text-xs font-semibold text-[#1E3A5F]">
                  Cited Excerpt · Page {selectedCitation.page}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-[#0F172A]">
                  <mark className="bg-[#FEF08A] px-1 text-[#0F172A]">
                    {selectedCitation.excerpt}
                  </mark>
                </p>
              </div>
            ) : (
              inspectedNotice.page_references.map((ref, idx) => (
                <div
                  key={`${ref.page}-${idx}`}
                  className="rounded-sm border border-[#CBD5E1] border-l-4 border-l-[#1E3A5F] bg-[#F7F8FA] p-3"
                >
                  <div className="font-mono text-xs font-semibold text-[#1E3A5F]">
                    Page {ref.page}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#0F172A]">
                    &ldquo;{ref.excerpt}&rdquo;
                  </p>
                </div>
              ))
            )}

            {/* Scanned Image Preview if available */}
            {inspectedNotice.file_data_url &&
              inspectedNotice.file_mime.startsWith("image/") && (
                <div className="rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={inspectedNotice.file_data_url}
                    alt={`Circular ${inspectedNotice.circular_no}`}
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              )}

            {/* Extracted Full Text */}
            <div>
              <div className="flex items-center justify-between text-xs text-[#475569]">
                <span className="font-semibold uppercase tracking-wide">
                  Full Circular Text
                </span>
                <span className="inline-flex items-center gap-1 font-mono">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  {inspectedNotice.file_name}
                </span>
              </div>
              <pre className="mt-2 whitespace-pre-wrap rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-3.5 font-mono text-xs leading-relaxed text-[#1E293B]">
                {inspectedNotice.extracted_text}
              </pre>
            </div>
          </div>
        ) : (
          <p className="p-6 text-sm text-[#475569]">
            No official circulars loaded yet.
          </p>
        )}
      </aside>
    </div>
  );
}
