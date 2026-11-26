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
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="circular-modal-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-white/80 bg-white/85 backdrop-blur-2xl shadow-2xl sm:rounded-l-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-slate-900/6 px-2.5 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F]">
                {notice.circular_no}
              </span>
              {notice.status === "active" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Superseded
                </span>
              )}
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {notice.effective_date}
              </span>
            </div>
            <h2
              id="circular-modal-title"
              className="mt-2 text-lg font-bold tracking-tight text-slate-900"
            >
              {notice.title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close circular proof viewer"
            className="cursor-pointer rounded-full bg-white/80 p-2 text-slate-500 ring-1 ring-slate-200/70 transition hover:bg-white hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Circular Switcher Strip */}
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200/50 px-6 py-2.5">
          {allNotices.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectNotice(item.id)}
              className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold transition ${
                item.id === notice.id
                  ? "bg-slate-900 text-white"
                  : "bg-white/70 text-slate-600 hover:bg-white"
              }`}
            >
              {item.circular_no}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {replacement && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-amber-500/12 p-4">
              <div className="text-xs text-amber-950">
                <strong>Superseded:</strong> Replaced by{" "}
                <span className="font-mono font-semibold">
                  {replacement.circular_no}
                </span>{" "}
                ({replacement.effective_date}).
              </div>
              <button
                type="button"
                onClick={() => onSelectNotice(replacement.id)}
                className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-50"
              >
                Open {replacement.circular_no}
              </button>
            </div>
          )}

          <p className="text-sm leading-relaxed text-slate-700">
            {notice.summary}
          </p>

          {notice.page_references.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-500">
                Page Excerpts
              </h3>
              {notice.page_references.map((ref, idx) => (
                <div
                  key={`${ref.page}-${idx}`}
                  className="rounded-2xl bg-white/75 p-4 ring-1 ring-white"
                >
                  <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                    Page {ref.page}
                  </span>
                  <p className="mt-1 text-xs leading-relaxed text-slate-800">
                    &ldquo;{ref.excerpt}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          )}

          {notice.file_data_url && notice.file_mime.startsWith("image/") && (
            <div className="overflow-hidden rounded-2xl bg-white/75 p-2 ring-1 ring-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={notice.file_data_url}
                alt={`Scanned notice ${notice.circular_no}`}
                className="max-h-80 w-full object-contain"
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold">Full Circular Text</span>
              <span className="inline-flex items-center gap-1 font-mono">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {notice.file_name}
              </span>
            </div>
            <pre className="mt-2 whitespace-pre-wrap rounded-2xl bg-white/75 p-4 font-mono text-xs leading-relaxed text-slate-700 ring-1 ring-white">
              {notice.extracted_text}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
