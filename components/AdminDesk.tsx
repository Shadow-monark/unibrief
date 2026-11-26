"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FilePlus2,
  FileText,
  Loader2,
  SkipForward,
  Trash2,
  Upload,
  Webhook,
  Workflow,
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          Admin / CR Ingestion Desk
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Drop college circulars, detect same-topic revisions automatically,
          supersede outdated deadlines, and broadcast alerts.
        </p>
      </div>

      {/* Ingestion Workbench + Pipeline Stepper */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Uploader (7 cols) */}
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className="inline-flex rounded-full border border-zinc-200 bg-zinc-100/90 p-1"
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
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
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
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                Quick Paste Circular Text
              </button>
            </div>

            {ingestMode === "paste" && (
              <button
                type="button"
                onClick={() => {
                  setPastedText(SAMPLE_REVISED_CIRCULAR);
                  setTitleHint("FEE_2026_059_Extended");
                }}
                className="cursor-pointer rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-[#1E3A5F] transition hover:border-zinc-400 hover:bg-white"
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
                className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
                  isDragging
                    ? "border-[#1E3A5F] bg-slate-50"
                    : "border-zinc-200 bg-zinc-50/50 hover:border-zinc-300"
                }`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs ring-1 ring-zinc-200">
                  <Upload className="h-5 w-5 text-[#1E3A5F]" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-900">
                  Drop official circulars here, or browse files
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Supports PDF, DOCX, TXT, PNG, JPG, WEBP (batch multi-file)
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
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-2 font-mono text-zinc-800">
                        <FileText
                          className="h-3.5 w-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        {file.name}{" "}
                        <span className="text-zinc-400">
                          ({Math.max(1, Math.round(file.size / 1024))} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setQueuedFiles((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        className="cursor-pointer rounded-full p-1 text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
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
              <label className="block text-xs font-medium text-zinc-700">
                Reference Label (Optional)
                <input
                  type="text"
                  value={titleHint}
                  onChange={(e) => setTitleHint(e.target.value)}
                  placeholder="e.g. EXAM_2026_110_Notice"
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 px-3.5 py-2 font-mono text-xs text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Official Circular Text
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste full circular text, Hindi-English notice, or revised deadline..."
                  className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 font-mono text-xs leading-relaxed text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
                />
              </label>
            </div>
          )}

          {/* Optional Auto-Alert Webhook */}
          <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-4">
            <label className="block text-xs font-semibold text-zinc-800">
              <span className="inline-flex items-center gap-1.5">
                <Webhook className="h-3.5 w-3.5 text-[#1E3A5F]" aria-hidden="true" />
                Auto-Alert Webhook URL (Optional — n8n / Discord / Telegram)
              </span>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => updateWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/... or n8n webhook URL"
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3.5 py-2 font-mono text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              />
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isIngesting}
              onClick={runIngestion}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isIngesting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isIngesting
                  ? "Running Pipeline..."
                  : "Ingest & Resolve Conflicts"}
              </span>
            </button>
          </div>
        </section>

        {/* Right: Visual Pipeline Stepper (5 cols) */}
        <section className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-5">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3.5">
            <h2 className="inline-flex items-center gap-2 text-base font-bold text-zinc-900">
              <Workflow className="h-4 w-4 text-[#1E3A5F]" aria-hidden="true" />
              Pipeline Execution Log
            </h2>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
              4-Loop Backend
            </span>
          </div>

          <div className="mt-4 flex-1 space-y-3 overflow-y-auto max-h-[400px]">
            {pipelineLogs.length === 0 ? (
              <div className="rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-600">
                <p className="font-semibold text-zinc-900">
                  Ready to run server-side loops:
                </p>
                <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-zinc-600">
                  <li>Structured JSON Extraction (3x retry backoff)</li>
                  <li>Topic Conflict Detection</li>
                  <li>Auto-Superseding Old Circulars &amp; Deadlines</li>
                  <li>Deadline Creation &amp; Webhook/In-App Alerts</li>
                </ol>
              </div>
            ) : (
              pipelineLogs.map((log, idx) => (
                <div
                  key={`${log.step}-${idx}`}
                  className="flex items-start gap-3 rounded-xl border border-zinc-200/80 bg-zinc-50/70 p-3.5 text-xs"
                >
                  {log.status === "completed" ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : log.status === "failed" ? (
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <SkipForward
                      className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900">
                        {log.step}
                      </span>
                      <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-500 uppercase ring-1 ring-zinc-200">
                        {log.status}
                      </span>
                    </div>
                    <p className="mt-1 text-zinc-600">{log.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Circulars Audit Archive */}
      <section className="rounded-2xl border border-zinc-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-zinc-900">
              Official Circulars Archive
            </h2>
            <p className="text-xs text-zinc-500">
              Audit trail of active and superseded campus circulars.
            </p>
          </div>

          <div
            className="inline-flex rounded-full border border-zinc-200 bg-zinc-100/90 p-1"
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
                    ? "bg-white text-zinc-900 shadow-xs"
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {status} (
                {status === "all"
                  ? notices.length
                  : notices.filter((n) => n.status === status).length}
                )
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2.5 p-4 sm:p-5">
          {filteredArchive.map((notice) => {
            const replacement = notice.superseded_by_id
              ? notices.find((n) => n.id === notice.superseded_by_id) ?? null
              : null;
            const isHighlighted = highlightedNoticeId === notice.id;

            return (
              <div
                id={`archive-row-${notice.id}`}
                key={notice.id}
                className={`flex flex-col gap-3 rounded-xl border p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  isHighlighted
                    ? "border-[#1E3A5F] bg-slate-50"
                    : "border-zinc-200/80 bg-zinc-50/40 hover:border-zinc-300 hover:bg-white"
                }`}
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                      {notice.circular_no}
                    </span>
                    {notice.status === "active" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Superseded
                      </span>
                    )}
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[11px] text-zinc-600">
                      {notice.topic_tag}
                    </span>
                    <span className="font-mono text-xs text-zinc-400 tabular-nums">
                      {notice.effective_date}
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold ${
                      notice.status === "superseded"
                        ? "text-zinc-500 line-through"
                        : "text-zinc-900"
                    }`}
                  >
                    {notice.title}
                  </h3>
                  <p className="text-xs text-zinc-600">{notice.summary}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {replacement && (
                    <button
                      type="button"
                      onClick={() => jumpToNotice(replacement.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 font-mono text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                    >
                      Replaced by {replacement.circular_no}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onInspectCircular(notice.id)}
                    className="cursor-pointer rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-900"
                  >
                    Inspect Proof
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
