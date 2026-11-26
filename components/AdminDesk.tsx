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
  Terminal,
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
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-sm border border-[#CBD5E1] bg-white p-5 sm:p-6">
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#0F172A]">
          Admin / CR Ingestion &amp; Conflict Resolution Desk
        </h1>
        <p className="mt-1 text-sm text-[#475569]">
          Upload official college PDFs, DOCX files, TXT notices, or scanned
          notice-board photos. AskCampus automatically extracts deadlines, detects
          same-topic revisions, supersedes outdated circulars, and pushes alerts.
        </p>
      </section>

      {/* Top Grid: Ingestion Workbench + Live Pipeline Logs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Uploader & Webhook Config (7 cols) */}
        <section className="space-y-4 rounded-sm border border-[#CBD5E1] bg-white p-5 lg:col-span-7">
          {/* Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E2E8F0] pb-3">
            <div
              className="inline-flex rounded-sm border border-[#CBD5E1] bg-[#EFF2F6] p-0.5"
              role="tablist"
              aria-label="Circular ingestion method"
            >
              <button
                type="button"
                role="tab"
                aria-selected={ingestMode === "files"}
                onClick={() => setIngestMode("files")}
                className={`cursor-pointer rounded-xs px-3 py-1.5 text-xs font-semibold ${
                  ingestMode === "files"
                    ? "bg-white text-[#0F172A] ring-1 ring-[#CBD5E1]"
                    : "text-[#475569] hover:text-[#0F172A]"
                }`}
              >
                Upload Files (Multi-Batch)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={ingestMode === "paste"}
                onClick={() => setIngestMode("paste")}
                className={`cursor-pointer rounded-xs px-3 py-1.5 text-xs font-semibold ${
                  ingestMode === "paste"
                    ? "bg-white text-[#0F172A] ring-1 ring-[#CBD5E1]"
                    : "text-[#475569] hover:text-[#0F172A]"
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
                className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-2.5 py-1 text-xs font-medium text-[#1E3A5F] hover:border-[#1E3A5F]"
              >
                Load Sample Revision Circular
              </button>
            )}
          </div>

          {/* Multi-file Dropzone */}
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
                className={`rounded-sm border border-dashed p-6 text-center transition-colors ${
                  isDragging
                    ? "border-[#1E3A5F] bg-[#EFF2F6]"
                    : "border-[#94A3B8] bg-[#F7F8FA]"
                }`}
              >
                <Upload
                  className="mx-auto h-7 w-7 text-[#1E3A5F]"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-medium text-[#0F172A]">
                  Drag and drop circulars here, or browse from device
                </p>
                <p className="mt-1 font-mono text-xs text-[#475569]">
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
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[#1E3A5F] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white"
                >
                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Select Circular Files
                </button>
              </div>

              {queuedFiles.length > 0 && (
                <ul className="divide-y divide-[#E2E8F0] rounded-sm border border-[#CBD5E1] bg-white">
                  {queuedFiles.map((file, idx) => (
                    <li
                      key={`${file.name}-${idx}`}
                      className="flex items-center justify-between gap-3 px-3.5 py-2 text-xs"
                    >
                      <span className="inline-flex items-center gap-2 font-mono text-[#0F172A]">
                        <FileText
                          className="h-3.5 w-3.5 text-[#1E3A5F]"
                          aria-hidden="true"
                        />
                        {file.name}{" "}
                        <span className="text-[#475569]">
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
                        className="cursor-pointer text-[#475569] hover:text-[#991B1B]"
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
              <label className="block text-xs font-medium text-[#334155]">
                Optional Reference Label
                <input
                  type="text"
                  value={titleHint}
                  onChange={(e) => setTitleHint(e.target.value)}
                  placeholder="e.g. EXAM_2026_110_Notice"
                  className="mt-1 w-full rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-3 py-1.5 font-mono text-xs text-[#0F172A]"
                />
              </label>
              <label className="block text-xs font-medium text-[#334155]">
                Official Circular Text
                <textarea
                  rows={6}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="Paste full circular text, Hindi-English notice, or revised deadline notice..."
                  className="mt-1 w-full rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-3 font-mono text-xs leading-relaxed text-[#0F172A]"
                />
              </label>
            </div>
          )}

          {/* Optional Auto-Alert Webhook */}
          <div className="rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] p-3.5">
            <label className="block text-xs font-semibold text-[#0F172A]">
              <span className="inline-flex items-center gap-1.5">
                <Webhook className="h-3.5 w-3.5 text-[#1E3A5F]" aria-hidden="true" />
                Auto-Alert Webhook URL (Optional — n8n / Discord / Telegram)
              </span>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => updateWebhookUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/... or n8n webhook URL"
                className="mt-1.5 w-full rounded-sm border border-[#CBD5E1] bg-white px-3 py-1.5 font-mono text-xs text-[#0F172A] placeholder:text-[#64748B]"
              />
            </label>
            <p className="mt-1 text-[11px] text-[#475569]">
              Saved locally in browser storage. Fired automatically whenever a
              circular is ingested.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={isIngesting}
              onClick={runIngestion}
              className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-[#1E3A5F] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#162C49] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isIngesting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-4 w-4" aria-hidden="true" />
              )}
              <span>
                {isIngesting
                  ? "Running Ingestion Pipeline..."
                  : "Ingest & Resolve Conflicts"}
              </span>
            </button>
          </div>
        </section>

        {/* Right: Real-Time Pipeline Execution Log (5 cols) */}
        <section className="flex flex-col rounded-sm border border-[#CBD5E1] bg-white p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="inline-flex items-center gap-2 font-serif text-lg font-semibold text-[#0F172A]">
              <Terminal className="h-4 w-4 text-[#1E3A5F]" aria-hidden="true" />
              Pipeline Execution Log
            </h2>
            <span className="font-mono text-xs text-[#475569]">
              4-Loop Backend
            </span>
          </div>

          <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto max-h-[380px]">
            {pipelineLogs.length === 0 ? (
              <div className="rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] p-4 text-xs leading-relaxed text-[#475569]">
                <p className="font-semibold text-[#0F172A]">
                  Ingestion stages ready:
                </p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 font-mono text-[11px]">
                  <li>Extracting Multimodal JSON (3x retry backoff)</li>
                  <li>Checking Topic Conflicts</li>
                  <li>Auto-Superseding Old Circulars &amp; Deadlines</li>
                  <li>Creating Deadlines &amp; Dispatching Alerts</li>
                </ol>
              </div>
            ) : (
              pipelineLogs.map((log, idx) => (
                <div
                  key={`${log.step}-${idx}`}
                  className="flex items-start gap-2.5 rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] p-3 text-xs"
                >
                  {log.status === "completed" ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#166534]"
                      aria-hidden="true"
                    />
                  ) : log.status === "failed" ? (
                    <XCircle
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#991B1B]"
                      aria-hidden="true"
                    />
                  ) : (
                    <SkipForward
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#475569]"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-[#0F172A]">
                        {log.step}
                      </span>
                      <span className="font-mono text-[10px] uppercase text-[#475569]">
                        {log.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[#334155]">{log.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Official Circulars Archive */}
      <section className="rounded-sm border border-[#CBD5E1] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CBD5E1] bg-[#F7F8FA] px-5 py-4">
          <div>
            <h2 className="font-serif text-xl font-semibold text-[#0F172A]">
              Official Circulars Archive
            </h2>
            <p className="text-xs text-[#475569]">
              Full audit trail of active and superseded university circulars.
            </p>
          </div>

          <div
            className="inline-flex rounded-sm border border-[#CBD5E1] bg-white p-0.5"
            role="group"
            aria-label="Filter circular archive"
          >
            {(["all", "active", "superseded"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setArchiveFilter(status)}
                aria-pressed={archiveFilter === status}
                className={`cursor-pointer rounded-xs px-3 py-1 text-xs font-semibold capitalize ${
                  archiveFilter === status
                    ? "bg-[#1E3A5F] text-white"
                    : "text-[#475569] hover:text-[#0F172A]"
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

        <div className="divide-y divide-[#E2E8F0]">
          {filteredArchive.map((notice) => {
            const replacement = notice.superseded_by_id
              ? notices.find((n) => n.id === notice.superseded_by_id) ?? null
              : null;
            const isHighlighted = highlightedNoticeId === notice.id;

            return (
              <div
                id={`archive-row-${notice.id}`}
                key={notice.id}
                className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between ${
                  isHighlighted ? "bg-[#EFF2F6]" : "bg-white"
                }`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                      {notice.circular_no}
                    </span>
                    {notice.status === "active" ? (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 text-[11px] font-medium text-[#166534]">
                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 text-[11px] font-medium text-[#92400E]">
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Superseded
                      </span>
                    )}
                    <span className="rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] px-2 py-0.5 font-mono text-[11px] text-[#475569]">
                      {notice.topic_tag}
                    </span>
                    <span className="font-mono text-xs text-[#475569] tabular-nums">
                      {notice.effective_date}
                    </span>
                  </div>

                  <h3
                    className={`text-sm font-semibold ${
                      notice.status === "superseded"
                        ? "text-[#475569] line-through"
                        : "text-[#0F172A]"
                    }`}
                  >
                    {notice.title}
                  </h3>
                  <p className="text-xs text-[#475569]">{notice.summary}</p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {replacement && (
                    <button
                      type="button"
                      onClick={() => jumpToNotice(replacement.id)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1.5 font-mono text-xs font-semibold text-[#92400E] hover:bg-[#FEF3C7]"
                    >
                      Replaced by {replacement.circular_no}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onInspectCircular(notice.id)}
                    className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] hover:border-[#1E3A5F] hover:bg-[#EFF2F6]"
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
