"use client";

import { useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  X,
} from "lucide-react";
import type { Notice } from "@/types/campus";

interface CircularPreviewModalProps {
  notice: Notice | null;
  allNotices: Notice[];
  onClose: () => void;
  onSelectNotice: (noticeId: string) => void;
}

export function CircularPreviewModal({
  notice,
  allNotices,
  onClose,
  onSelectNotice,
}: CircularPreviewModalProps) {
  useEffect(() => {
    if (!notice) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [notice, onClose]);

  if (!notice) return null;

  const replacement = notice.superseded_by_id
    ? allNotices.find((n) => n.id === notice.superseded_by_id) ?? null
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="circular-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-[#CBD5E1] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#CBD5E1] bg-[#F7F8FA] px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-sm border border-[#CBD5E1] bg-white px-2 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F]">
                {notice.circular_no}
              </span>
              {notice.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 text-xs font-medium text-[#166534]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Active Official Record
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 text-xs font-medium text-[#92400E]">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Superseded
                </span>
              )}
              <span className="font-mono text-xs text-[#475569] tabular-nums">
                Effective: {notice.effective_date}
              </span>
            </div>
            <h2
              id="circular-modal-title"
              className="mt-2 font-serif text-xl font-semibold text-[#0F172A]"
            >
              {notice.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close circular proof viewer"
            className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-white p-1.5 text-[#475569] hover:bg-[#EFF2F6] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {replacement && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] p-3.5">
              <div className="text-sm text-[#92400E]">
                <strong>Notice Overridden:</strong> This circular has been
                superseded by{" "}
                <span className="font-mono font-semibold">
                  {replacement.circular_no}
                </span>{" "}
                ({replacement.effective_date}).
              </div>
              <button
                type="button"
                onClick={() => onSelectNotice(replacement.id)}
                className="cursor-pointer rounded-sm border border-[#92400E] bg-white px-2.5 py-1 text-xs font-semibold text-[#92400E] hover:bg-[#FEF3C7]"
              >
                Jump to {replacement.circular_no}
              </button>
            </div>
          )}

          {/* Metadata grid */}
          <dl className="grid grid-cols-2 gap-3 rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] p-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-[#475569]">Topic</dt>
              <dd className="mt-0.5 font-mono font-medium text-[#0F172A]">
                {notice.topic_tag}
              </dd>
            </div>
            <div>
              <dt className="text-[#475569]">Branches</dt>
              <dd className="mt-0.5 font-medium text-[#0F172A]">
                {notice.target_branches.join(", ") || "All"}
              </dd>
            </div>
            <div>
              <dt className="text-[#475569]">Semesters</dt>
              <dd className="mt-0.5 font-mono font-medium text-[#0F172A] tabular-nums">
                {notice.target_semesters.length === 8
                  ? "1–8 (All)"
                  : notice.target_semesters.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-[#475569]">Audience</dt>
              <dd className="mt-0.5 font-medium capitalize text-[#0F172A]">
                {notice.audience_type.replace("_", " ")}
              </dd>
            </div>
          </dl>

          {/* Summary */}
          <div>
            <h3 className="text-xs font-semibold tracking-wide text-[#475569] uppercase">
              Verified Summary
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#0F172A]">
              {notice.summary}
            </p>
          </div>

          {/* Page Citations */}
          {notice.page_references.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-[#475569] uppercase">
                Page &amp; Clause Excerpts
              </h3>
              <div className="mt-2 space-y-2.5">
                {notice.page_references.map((ref, idx) => (
                  <div
                    key={`${ref.page}-${idx}`}
                    className="rounded-sm border border-[#CBD5E1] border-l-4 border-l-[#1E3A5F] bg-[#F7F8FA] p-3"
                  >
                    <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                      Page {ref.page}
                    </span>
                    <p className="mt-1 text-sm leading-relaxed text-[#0F172A]">
                      &ldquo;{ref.excerpt}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Uploaded File Preview */}
          {notice.file_data_url && notice.file_mime.startsWith("image/") && (
            <div>
              <h3 className="text-xs font-semibold tracking-wide text-[#475569] uppercase">
                Original Scanned Document ({notice.file_name})
              </h3>
              <div className="mt-2 overflow-hidden rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={notice.file_data_url}
                  alt={`Scanned notice ${notice.circular_no}`}
                  className="max-h-80 w-full object-contain"
                />
              </div>
            </div>
          )}

          {/* Full Extracted Text */}
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-[#475569] uppercase">
                Extracted Circular Text
              </h3>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-[#475569]">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {notice.file_name}
              </span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-4 font-mono text-xs leading-relaxed text-[#1E293B]">
              {notice.extracted_text}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
