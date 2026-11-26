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
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="circular-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl sm:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F]">
                {notice.circular_no}
              </span>
              {notice.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Active Record
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Superseded
                </span>
              )}
              <span className="font-mono text-xs text-zinc-500 tabular-nums">
                {notice.effective_date}
              </span>
            </div>
            <h2
              id="circular-modal-title"
              className="mt-2.5 text-xl font-bold tracking-tight text-zinc-900"
            >
              {notice.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close circular proof viewer"
            className="cursor-pointer rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {replacement && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
              <div className="text-sm text-amber-950">
                <strong>Notice Overridden:</strong> Superseded by{" "}
                <span className="font-mono font-semibold">
                  {replacement.circular_no}
                </span>{" "}
                ({replacement.effective_date}).
              </div>
              <button
                type="button"
                onClick={() => onSelectNotice(replacement.id)}
                className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
              >
                Jump to {replacement.circular_no}
              </button>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4 text-xs sm:grid-cols-4">
            <div>
              <dt className="text-zinc-500">Topic</dt>
              <dd className="mt-0.5 font-mono font-semibold text-zinc-900">
                {notice.topic_tag}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Branches</dt>
              <dd className="mt-0.5 font-semibold text-zinc-900">
                {notice.target_branches.join(", ") || "All"}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Semesters</dt>
              <dd className="mt-0.5 font-mono font-semibold text-zinc-900 tabular-nums">
                {notice.target_semesters.length === 8
                  ? "1–8 (All)"
                  : notice.target_semesters.join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-zinc-500">Audience</dt>
              <dd className="mt-0.5 font-semibold capitalize text-zinc-900">
                {notice.audience_type.replace("_", " ")}
              </dd>
            </div>
          </dl>

          <div>
            <h3 className="text-xs font-semibold text-zinc-500">
              Verified Summary
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-800">
              {notice.summary}
            </p>
          </div>

          {notice.page_references.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-zinc-500">
                Page &amp; Clause Excerpts
              </h3>
              {notice.page_references.map((ref, idx) => (
                <div
                  key={`${ref.page}-${idx}`}
                  className="rounded-xl border border-zinc-200/80 border-l-4 border-l-[#1E3A5F] bg-zinc-50/70 p-3.5"
                >
                  <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                    Page {ref.page}
                  </span>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-800">
                    &ldquo;{ref.excerpt}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          )}

          {notice.file_data_url && notice.file_mime.startsWith("image/") && (
            <div>
              <h3 className="text-xs font-semibold text-zinc-500">
                Scanned Notice ({notice.file_name})
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={notice.file_data_url}
                  alt={`Scanned notice ${notice.circular_no}`}
                  className="max-h-80 w-full object-contain"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-500">
                Extracted Circular Text
              </h3>
              <span className="inline-flex items-center gap-1 font-mono text-xs text-zinc-500">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {notice.file_name}
              </span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs leading-relaxed text-zinc-700">
              {notice.extracted_text}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
