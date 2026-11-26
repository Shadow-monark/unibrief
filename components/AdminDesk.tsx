"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FilePlus2,
  FileText,
  Loader2,
  SkipForward,
  Trash2,
  Upload,
  Webhook,
  XCircle,
} from "lucide-react";
import type {
  IngestResponse,
  Notice,
  PipelineLogEntry,
} from "@/types/campus";

interface AdminDeskProps {
  notices: Notice[];
  onIngestComplete: () => Promise<void>;
  onInspectCircular: (noticeId: string) => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}

const WEBHOOK_STORAGE_KEY = "askcampus_webhook_url";
const webhookListeners = new Set<() => void>();

function subscribeWebhookStore(callback: () => void): () => void {
  webhookListeners.add(callback);
  const onStorage = (e: StorageEvent) => {
    if (e.key === WEBHOOK_STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    webhookListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

function getWebhookSnapshot(): string {
  try {
    return window.localStorage.getItem(WEBHOOK_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function getWebhookServerSnapshot(): string {
  return "";
}

const SAMPLE_REVISED_CIRCULAR = `OFFICE OF THE ACCOUNTS & EXAMINATION CELL
Circular No: FEE/2026/059 | Date: 25 Nov 2026
Subject: EXTENSION OF END-SEMESTER EXAM FORM & FEE DEADLINE (Supersedes FEE/2026/051)
1. Considering university portal maintenance, the End-Semester Examination Form & Fee submission deadline notified earlier vide FEE/2026/051 (29 Nov 2026) is hereby extended to 05 Dec 2026 (11:59 PM) for all branches and semesters (Sem 1-8).
2. Late Fine Clause: Submissions after 05 Dec 2026 will attract ₹500/day late fine without exception.`;

export function AdminDesk({
  notices,
  onIngestComplete,
  onInspectCircular,
  onToast,
}: AdminDeskProps) {
  const [ingestMode, setIngestMode] = useState<"files" | "paste">("files");
  const [queuedFiles, setQueuedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [titleHint, setTitleHint] = useState("");
  const webhookUrl = useSyncExternalStore(
    subscribeWebhookStore,
    getWebhookSnapshot,
    getWebhookServerSnapshot
  );
  const [isIngesting, setIsIngesting] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<PipelineLogEntry[]>([]);
  const [archiveFilter, setArchiveFilter] = useState<
    "all" | "active" | "superseded"
  >("all");
  const [highlightedNoticeId, setHighlightedNoticeId] = useState<string | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function updateWebhookUrl(next: string) {
    try {
      if (next.trim()) {
        window.localStorage.setItem(WEBHOOK_STORAGE_KEY, next);
      } else {
        window.localStorage.removeItem(WEBHOOK_STORAGE_KEY);
      }
      webhookListeners.forEach((listener) => listener());
    } catch {
      // Ignore storage errors
    }
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);
    setQueuedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const unique = list.filter(
        (f) => !existingNames.has(`${f.name}-${f.size}`)
      );
      return [...prev, ...unique];
    });
  }

  async function runIngestion() {
    if (isIngesting) return;

    if (ingestMode === "files" && queuedFiles.length === 0) {
      onToast("Add at least one PDF, DOCX, TXT, or notice image first.", "error");
      return;
    }
    if (ingestMode === "paste" && !pastedText.trim()) {
      onToast("Paste the circular text before running extraction.", "error");
      return;
    }

    setIsIngesting(true);
    setPipelineLogs([
      {
        step: "Extracting Multimodal JSON",
        status: "completed",
        detail: "Sending payload to Groq AI extraction pipeline...",
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const fd = new FormData();
      if (ingestMode === "files") {
        for (const file of queuedFiles) {
          fd.append("files", file);
        }
      } else {
        fd.append("pastedText", pastedText.trim());
        if (titleHint.trim()) fd.append("titleHint", titleHint.trim());
      }

      if (webhookUrl.trim()) {
        fd.append("webhookUrl", webhookUrl.trim());
      }

      const res = await fetch("/api/ingest", {
        method: "POST",
        body: fd,
      });

      const data = (await res.json()) as IngestResponse & { error?: string };
      if (!res.ok) {
        const msg = data.error || "Document ingestion failed.";
        onToast(msg, "error");
        setPipelineLogs((prev) => [
          ...prev,
          {
            step: "Error",
            status: "failed",
            detail: msg,
            timestamp: new Date().toISOString(),
          },
        ]);
        return;
      }

      setPipelineLogs(data.logs);
      await onIngestComplete();

      if (ingestMode === "files") {
        setQueuedFiles([]);
      } else {
        setPastedText("");
        setTitleHint("");
      }

      const count = data.results.length;
      const supersededTotal = data.results.reduce(
        (sum, item) => sum + item.superseded_notice_ids.length,
        0
      );
      onToast(
        `Ingested ${count} circular${count === 1 ? "" : "s"}${
          supersededTotal > 0
            ? ` and auto-superseded ${supersededTotal} outdated notice(s)`
            : ""
        }.`,
        "success"
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Network error during ingestion.";
      onToast(msg, "error");
      setPipelineLogs((prev) => [
        ...prev,
        {
          step: "Error",
          status: "failed",
          detail: msg,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsIngesting(false);
    }
  }

  const filteredArchive = notices.filter((n) =>
    archiveFilter === "all" ? true : n.status === archiveFilter
  );

  function jumpToNotice(targetId: string) {
    setArchiveFilter("all");
    setHighlightedNoticeId(targetId);
    const el = document.getElementById(`archive-row-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    onInspectCircular(targetId);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="px-1">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Admin Ingestion
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Upload circulars or paste revisions to auto-supersede old notices.
        </p>
      </div>

      {/* Frosted Upload Studio */}
      <section className="glass-panel space-y-5 rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="inline-flex rounded-full bg-slate-900/6 p-1"
            role="tablist"
            aria-label="Circular ingestion method"
          >
            <button
              type="button"
              role="tab"
              aria-selected={ingestMode === "files"}
              onClick={() => setIngestMode("files")}
              className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                ingestMode === "files"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Upload Files
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={ingestMode === "paste"}
              onClick={() => setIngestMode("paste")}
              className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition ${
                ingestMode === "paste"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Paste Text
            </button>
          </div>

          {ingestMode === "paste" && (
            <button
              type="button"
              onClick={() => {
                setPastedText(SAMPLE_REVISED_CIRCULAR);
                setTitleHint("FEE_2026_059_Extended");
              }}
              className="cursor-pointer rounded-full bg-white/80 px-3.5 py-1 text-xs font-semibold text-[#1E3A5F] ring-1 ring-slate-200/80 transition hover:bg-white"
            >
              Load Sample Revision
            </button>
          )}
        </div>

        {ingestMode === "files" ? (
          <div className="space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                addFiles(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
                isDragging
                  ? "border-slate-900 bg-white/80"
                  : "border-slate-300/70 bg-white/40 hover:bg-white/60"
              }`}
            >
              <Upload
                className="mx-auto h-7 w-7 text-slate-600"
                aria-hidden="true"
              />
              <p className="mt-2.5 text-sm font-semibold text-slate-800">
                Drop PDF, DOCX, TXT, or notice photos here
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs ring-1 ring-slate-200/80 transition hover:bg-slate-900 hover:text-white"
              >
                <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                Choose Files
              </button>
            </div>

            {queuedFiles.length > 0 && (
              <ul className="space-y-1.5">
                {queuedFiles.map((file, idx) => (
                  <li
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-white/75 px-4 py-2 text-xs"
                  >
                    <span className="inline-flex items-center gap-2 font-mono text-slate-800">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      {file.name}
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() =>
                        setQueuedFiles((prev) =>
                          prev.filter((_, i) => i !== idx)
                        )
                      }
                      className="cursor-pointer rounded-full p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={titleHint}
              onChange={(e) => setTitleHint(e.target.value)}
              aria-label="Optional reference label"
              placeholder="Optional reference label (e.g. EXAM_2026_110)"
              className="w-full rounded-2xl bg-white/80 px-4 py-2.5 font-mono text-xs text-slate-900 placeholder:text-slate-400 ring-1 ring-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
            <textarea
              rows={5}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              aria-label="Official circular text"
              placeholder="Paste full circular text here..."
              className="w-full rounded-2xl bg-white/80 p-4 font-mono text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 ring-1 ring-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2 rounded-full bg-white/75 px-3.5 py-2 ring-1 ring-white">
            <Webhook
              className="h-3.5 w-3.5 shrink-0 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => updateWebhookUrl(e.target.value)}
              aria-label="Auto-alert webhook URL"
              placeholder="Optional webhook URL (n8n / Discord / Telegram)"
              className="w-full bg-transparent font-mono text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <button
            type="button"
            disabled={isIngesting}
            onClick={runIngestion}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isIngesting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            <span>
              {isIngesting ? "Ingesting..." : "Ingest & Resolve Conflicts"}
            </span>
          </button>
        </div>

        {/* Pipeline Execution Steps (shown cleanly when active) */}
        {pipelineLogs.length > 0 && (
          <div className="space-y-2 border-t border-white/70 pt-4">
            {pipelineLogs.map((log, idx) => (
              <div
                key={`${log.step}-${idx}`}
                className="flex items-start gap-2.5 rounded-2xl bg-white/70 px-4 py-2.5 text-xs"
              >
                {log.status === "completed" ? (
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : log.status === "failed" ? (
                  <XCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600"
                    aria-hidden="true"
                  />
                ) : (
                  <SkipForward
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <div>
                  <span className="font-semibold text-slate-900">
                    {log.step}:{" "}
                  </span>
                  <span className="text-slate-600">{log.detail}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Circulars Archive */}
      <section className="glass-panel rounded-3xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <h2 className="text-base font-semibold text-slate-900">
            Circulars Archive ({filteredArchive.length})
          </h2>

          <div
            className="inline-flex rounded-full bg-slate-900/6 p-1"
            role="group"
            aria-label="Filter circular archive"
          >
            {(["all", "active", "superseded"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setArchiveFilter(status)}
                aria-pressed={archiveFilter === status}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${
                  archiveFilter === status
                    ? "bg-white text-slate-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredArchive.map((notice) => {
            const replacement = notice.superseded_by_id
              ? notices.find((n) => n.id === notice.superseded_by_id) ?? null
              : null;
            const isHighlighted = highlightedNoticeId === notice.id;

            return (
              <div
                id={`archive-row-${notice.id}`}
                key={notice.id}
                className={`glass-card flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between ${
                  isHighlighted ? "ring-2 ring-slate-900" : ""
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                      {notice.circular_no}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        notice.status === "active"
                          ? "bg-emerald-500/12 text-emerald-800"
                          : "bg-amber-500/15 text-amber-900"
                      }`}
                    >
                      {notice.status === "active" ? "Active" : "Superseded"}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {notice.effective_date}
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold ${
                      notice.status === "superseded"
                        ? "text-slate-500 line-through"
                        : "text-slate-900"
                    }`}
                  >
                    {notice.title}
                  </h3>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {replacement && (
                    <button
                      type="button"
                      onClick={() => jumpToNotice(replacement.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 font-mono text-xs font-semibold text-amber-900 transition hover:bg-amber-500/25"
                    >
                      Replaced by {replacement.circular_no}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onInspectCircular(notice.id)}
                    className="cursor-pointer rounded-full bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-slate-800 ring-1 ring-slate-200/80 transition hover:bg-slate-900 hover:text-white"
                  >
                    Inspect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
