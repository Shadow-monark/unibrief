"use client";

import {
  AlertOctagon,
  BellRing,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  FileCheck2,
  ShieldAlert,
} from "lucide-react";
import { downloadIcsFile } from "@/lib/ics";
import { filterDeadlinesForProfile, getDeadlineCountdown } from "@/lib/profile";
import type { AlertLog, Deadline, Notice, StudentProfile } from "@/types/campus";

interface DeadlineRadarProps {
  deadlines: Deadline[];
  notices: Notice[];
  alertLogs: AlertLog[];
  profile: StudentProfile;
  togglingId: string | null;
  onToggleDeadline: (id: string, completed: boolean) => void;
  onInspectCircular: (noticeId: string) => void;
}

export function DeadlineRadar({
  deadlines,
  notices,
  alertLogs,
  profile,
  togglingId,
  onToggleDeadline,
  onInspectCircular,
}: DeadlineRadarProps) {
  const activeDeadlines = filterDeadlinesForProfile(deadlines, profile, false);
  const supersededCount = filterDeadlinesForProfile(
    deadlines,
    profile,
    true
  ).filter((d) => d.status === "superseded").length;

  const pendingCount = activeDeadlines.filter((d) => !d.completed).length;
  const criticalPendingCount = activeDeadlines.filter(
    (d) => !d.completed && d.urgency === "critical"
  ).length;
  const completedCount = activeDeadlines.filter((d) => d.completed).length;

  return (
    <div className="space-y-6">
      {/* Header + Metric Strip */}
      <section className="rounded-sm border border-[#CBD5E1] bg-white p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#0F172A]">
              Anti-Fine Deadline Radar
            </h1>
            <p className="mt-1 text-sm text-[#475569]">
              Active obligations filtered for{" "}
              <span className="font-semibold text-[#0F172A]">
                {profile.branch === "All" ? "All Branches" : profile.branch} ·
                Sem {profile.semester} · {profile.residence}
              </span>
              . Superseded circulars are automatically retired so you never act
              on outdated dates.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <MetricCell
              label="Pending"
              value={pendingCount}
              tone="neutral"
            />
            <MetricCell
              label="Critical Fines"
              value={criticalPendingCount}
              tone={criticalPendingCount > 0 ? "danger" : "neutral"}
            />
            <MetricCell
              label="Done"
              value={completedCount}
              tone="success"
            />
          </div>
        </div>
      </section>

      {/* Main Split: Deadlines Ledger + Live Alert Feed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Deadlines List (8 cols) */}
        <div className="space-y-3 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F172A]">
              Upcoming Action Items ({activeDeadlines.length})
            </h2>
            {supersededCount > 0 && (
              <span className="font-mono text-xs text-[#475569]">
                {supersededCount} outdated deadline hidden
              </span>
            )}
          </div>

          {activeDeadlines.length === 0 ? (
            <div className="rounded-sm border border-[#CBD5E1] bg-white p-8 text-center">
              <FileCheck2
                className="mx-auto h-8 w-8 text-[#475569]"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-medium text-[#0F172A]">
                No active deadlines match {profile.branch} Sem{" "}
                {profile.semester} ({profile.residence}).
              </p>
              <p className="mt-1 text-xs text-[#475569]">
                Switch Branch to &ldquo;All&rdquo; or ingest a new circular in
                Admin / CR Desk.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#CBD5E1] rounded-sm border border-[#CBD5E1] bg-white">
              {activeDeadlines.map((deadline) => {
                const countdown = getDeadlineCountdown(deadline.due_date);
                const notice = notices.find((n) => n.id === deadline.notice_id);
                const isToggling = togglingId === deadline.id;

                return (
                  <article
                    key={deadline.id}
                    className={`p-4 sm:p-5 transition-colors duration-150 ${
                      deadline.completed ? "bg-[#F7F8FA]/80" : "bg-white"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: Checkbox + Core Details */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleDeadline(deadline.id, !deadline.completed)
                          }
                          disabled={isToggling}
                          aria-label={
                            deadline.completed
                              ? `Mark ${deadline.title} as pending`
                              : `Mark ${deadline.title} as done`
                          }
                          aria-pressed={deadline.completed}
                          className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-xs border transition-colors ${
                            deadline.completed
                              ? "border-[#166534] bg-[#166534] text-white"
                              : "border-[#64748B] bg-white hover:border-[#1E3A5F]"
                          } disabled:opacity-50`}
                        >
                          {deadline.completed && (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>

                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <CountdownBadge
                              label={countdown.label}
                              tone={
                                deadline.completed ? "done" : countdown.tone
                              }
                            />
                            <UrgencyTag urgency={deadline.urgency} />
                            <button
                              type="button"
                              onClick={() =>
                                onInspectCircular(deadline.notice_id)
                              }
                              className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-[#EFF2F6] px-2 py-0.5 font-mono text-xs font-medium text-[#1E3A5F] hover:border-[#1E3A5F] hover:bg-white"
                            >
                              {deadline.circular_no}
                            </button>
                          </div>

                          <h3
                            className={`text-base font-semibold ${
                              deadline.completed
                                ? "text-[#475569] line-through"
                                : "text-[#0F172A]"
                            }`}
                          >
                            {deadline.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#475569]">
                            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-[#0F172A]">
                              <Clock
                                className="h-3.5 w-3.5 text-[#1E3A5F]"
                                aria-hidden="true"
                              />
                              {deadline.due_date} · {deadline.due_time}
                            </span>
                            <span>
                              Target: {deadline.target_branches.join(", ")} ·
                              Sem{" "}
                              {deadline.target_semesters.length === 8
                                ? "All"
                                : deadline.target_semesters.join(", ")}
                            </span>
                          </div>

                          {/* Penalty Impact Tag */}
                          <div className="inline-flex items-center gap-1.5 rounded-sm border border-[#FCA5A5] bg-[#FEF2F2] px-2.5 py-1 text-xs font-medium text-[#991B1B]">
                            <AlertOctagon
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>Penalty: {deadline.penalty_impact}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:flex-col sm:items-end sm:pl-0">
                        <button
                          type="button"
                          onClick={() =>
                            downloadIcsFile({
                              uid: `${deadline.id}@askcampus.edu`,
                              title: deadline.title,
                              date: deadline.due_date,
                              time: deadline.due_time,
                              circularNo: deadline.circular_no,
                              description: `Penalty Impact: ${deadline.penalty_impact}${
                                notice ? `\n\nSummary: ${notice.summary}` : ""
                              }`,
                            })
                          }
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-[#1E3A5F] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E3A5F] transition-colors hover:bg-[#1E3A5F] hover:text-white"
                        >
                          <CalendarPlus
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Add to Calendar (.ics)
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onToggleDeadline(deadline.id, !deadline.completed)
                          }
                          disabled={isToggling}
                          className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-2.5 py-1 text-xs font-medium text-[#334155] hover:bg-[#EFF2F6] disabled:opacity-50"
                        >
                          {deadline.completed ? "Reopen Task" : "Mark as Done"}
                        </button>

                        {deadline.action_url && (
                          <a
                            href={deadline.action_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1E3A5F] underline underline-offset-2 hover:text-[#162C49]"
                          >
                            ERP Portal
                            <ExternalLink
                              className="h-3 w-3"
                              aria-hidden="true"
                            />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Live Alert Feed (4 cols) */}
        <aside className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F172A]">
              <BellRing
                className="h-4 w-4 text-[#1E3A5F]"
                aria-hidden="true"
              />
              Live Alert Feed
            </h2>
            <span className="font-mono text-xs text-[#475569] tabular-nums">
              {alertLogs.length} events
            </span>
          </div>

          <div className="divide-y divide-[#E2E8F0] rounded-sm border border-[#CBD5E1] bg-white">
            {alertLogs.length === 0 ? (
              <p className="p-5 text-xs text-[#475569]">
                No alerts dispatched yet.
              </p>
            ) : (
              alertLogs.slice(0, 12).map((alert) => (
                <div key={alert.id} className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectCircular(alert.notice_id)}
                      className="cursor-pointer font-mono text-xs font-semibold text-[#1E3A5F] hover:underline"
                    >
                      {alert.circular_no}
                    </button>
                    <span
                      className={`rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase ${
                        alert.channel === "webhook"
                          ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                          : "border-[#CBD5E1] bg-[#F7F8FA] text-[#475569]"
                      }`}
                    >
                      {alert.channel === "webhook" ? "Webhook" : "In-App"}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[#334155]">
                    {alert.message}
                  </p>
                  <p className="font-mono text-[11px] text-[#475569] tabular-nums">
                    {new Date(alert.sent_at).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "danger" | "success";
}) {
  const styles =
    tone === "danger"
      ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
      : tone === "success"
        ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
        : "border-[#CBD5E1] bg-[#F7F8FA] text-[#0F172A]";

  return (
    <div className={`rounded-sm border px-3 py-2 text-center ${styles}`}>
      <div className="font-mono text-lg font-semibold leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1 text-[11px] font-medium whitespace-nowrap">
        {label}
      </div>
    </div>
  );
}

function CountdownBadge({
  label,
  tone,
}: {
  label: string;
  tone: "overdue" | "soon" | "upcoming" | "done";
}) {
  if (tone === "done") {
    return (
      <span className="rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 font-mono text-xs font-semibold text-[#166534]">
        Completed
      </span>
    );
  }
  if (tone === "overdue") {
    return (
      <span className="rounded-sm border border-[#FCA5A5] bg-[#FEF2F2] px-2 py-0.5 font-mono text-xs font-semibold text-[#991B1B] tabular-nums">
        {label}
      </span>
    );
  }
  if (tone === "soon") {
    return (
      <span className="rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 font-mono text-xs font-semibold text-[#92400E] tabular-nums">
        {label}
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-2 py-0.5 font-mono text-xs font-semibold text-[#1E3A5F] tabular-nums">
      {label}
    </span>
  );
}

function UrgencyTag({ urgency }: { urgency: Deadline["urgency"] }) {
  if (urgency === "critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-[#991B1B] px-2 py-0.5 font-mono text-[11px] font-semibold text-white uppercase">
        <ShieldAlert className="h-3 w-3" aria-hidden="true" />
        Critical
      </span>
    );
  }
  if (urgency === "high") {
    return (
      <span className="rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#92400E] uppercase">
        High
      </span>
    );
  }
  return (
    <span className="rounded-sm border border-[#CBD5E1] bg-white px-2 py-0.5 font-mono text-[11px] font-medium text-[#475569] uppercase">
      Normal
    </span>
  );
}
