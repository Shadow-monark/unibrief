"use client";

import {
  AlertOctagon,
  BellRing,
  CalendarPlus,
  Check,
  Clock,
  ExternalLink,
  FileCheck2,
  Flame,
  Sparkles,
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

  const pendingList = activeDeadlines.filter((d) => !d.completed);
  const criticalPendingCount = pendingList.filter(
    (d) => d.urgency === "critical"
  ).length;
  const completedCount = activeDeadlines.filter((d) => d.completed).length;

  const prioritySpotlight =
    pendingList.find((d) => d.urgency === "critical") ?? pendingList[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Deadline Radar
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Tailored for{" "}
            <span className="font-semibold text-zinc-900">
              {profile.branch === "All" ? "All Branches" : profile.branch} ·
              Semester {profile.semester} · {profile.residence}
            </span>
            {supersededCount > 0 && (
              <span className="ml-1.5 text-zinc-500">
                ({supersededCount} outdated schedule retired automatically)
              </span>
            )}
          </p>
        </div>

        {/* Summary Stat Chips */}
        <div className="flex flex-wrap items-center gap-2.5">
          <StatPill label="Pending" value={pendingList.length} tone="neutral" />
          <StatPill
            label="Critical Fines"
            value={criticalPendingCount}
            tone={criticalPendingCount > 0 ? "danger" : "neutral"}
          />
          <StatPill label="Done" value={completedCount} tone="success" />
        </div>
      </div>

      {/* Priority Spotlight Card */}
      {prioritySpotlight && (
        <section className="relative overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-r from-rose-50/80 via-white to-white p-5 shadow-[0_2px_10px_rgba(225,29,72,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                  <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                  Priority Action
                </span>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 font-mono text-xs font-semibold text-rose-800 tabular-nums">
                  {getDeadlineCountdown(prioritySpotlight.due_date).label}
                </span>
                <button
                  type="button"
                  onClick={() => onInspectCircular(prioritySpotlight.notice_id)}
                  className="cursor-pointer rounded-full border border-zinc-200 bg-white px-2.5 py-0.5 font-mono text-xs font-medium text-zinc-700 transition hover:border-zinc-400"
                >
                  {prioritySpotlight.circular_no}
                </button>
              </div>
              <h2 className="text-lg font-semibold text-zinc-900">
                {prioritySpotlight.title}
              </h2>
              <p className="text-sm text-rose-800">
                <span className="font-semibold">Penalty at risk:</span>{" "}
                {prioritySpotlight.penalty_impact} · Due{" "}
                <span className="font-mono font-medium">
                  {prioritySpotlight.due_date} ({prioritySpotlight.due_time})
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  downloadIcsFile({
                    uid: `${prioritySpotlight.id}@askcampus.edu`,
                    title: prioritySpotlight.title,
                    date: prioritySpotlight.due_date,
                    time: prioritySpotlight.due_time,
                    circularNo: prioritySpotlight.circular_no,
                    description: `Penalty: ${prioritySpotlight.penalty_impact}`,
                  })
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-4 py-2 text-xs font-semibold text-zinc-800 shadow-2xs transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <CalendarPlus className="h-4 w-4 text-[#1E3A5F]" aria-hidden="true" />
                Save to Calendar (.ics)
              </button>
              <button
                type="button"
                disabled={togglingId === prioritySpotlight.id}
                onClick={() =>
                  onToggleDeadline(prioritySpotlight.id, true)
                }
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:opacity-50"
              >
                <Check className="h-4 w-4" aria-hidden="true" />
                Mark Done
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Deadlines Cards (8 cols) */}
        <div className="space-y-3.5 lg:col-span-8">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-zinc-800">
              All Active Deadlines ({activeDeadlines.length})
            </h2>
          </div>

          {activeDeadlines.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center shadow-[0_1px_3px_rgba(15,23,42,0.03)]">
              <FileCheck2
                className="mx-auto h-9 w-9 text-zinc-400"
                aria-hidden="true"
              />
              <p className="mt-3 text-sm font-semibold text-zinc-900">
                No active deadlines for {profile.branch} Semester{" "}
                {profile.semester} ({profile.residence})
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Switch Branch to &ldquo;All Branches&rdquo; or upload a circular
                in Admin Desk.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeDeadlines.map((deadline) => {
                const countdown = getDeadlineCountdown(deadline.due_date);
                const notice = notices.find((n) => n.id === deadline.notice_id);
                const isToggling = togglingId === deadline.id;

                return (
                  <article
                    key={deadline.id}
                    className={`group rounded-2xl border p-5 transition-all duration-200 ${
                      deadline.completed
                        ? "border-zinc-200/70 bg-zinc-50/70 opacity-80"
                        : "border-zinc-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-zinc-300 hover:shadow-[0_6px_18px_rgba(15,23,42,0.05)]"
                    }`}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      {/* Left: Check button + Content */}
                      <div className="flex items-start gap-3.5 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleDeadline(deadline.id, !deadline.completed)
                          }
                          disabled={isToggling}
                          aria-label={
                            deadline.completed
                              ? `Reopen ${deadline.title}`
                              : `Mark ${deadline.title} as done`
                          }
                          aria-pressed={deadline.completed}
                          className={`mt-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border transition-all ${
                            deadline.completed
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-zinc-300 bg-white text-transparent hover:border-zinc-900"
                          } disabled:opacity-50`}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>

                        <div className="min-w-0 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <CountdownPill
                              label={countdown.label}
                              tone={
                                deadline.completed ? "done" : countdown.tone
                              }
                            />
                            <UrgencyPill urgency={deadline.urgency} />
                            <button
                              type="button"
                              onClick={() =>
                                onInspectCircular(deadline.notice_id)
                              }
                              className="cursor-pointer rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 font-mono text-xs font-medium text-[#1E3A5F] transition hover:border-[#1E3A5F] hover:bg-white"
                            >
                              {deadline.circular_no}
                            </button>
                          </div>

                          <h3
                            className={`text-base font-semibold tracking-tight ${
                              deadline.completed
                                ? "text-zinc-500 line-through"
                                : "text-zinc-900"
                            }`}
                          >
                            {deadline.title}
                          </h3>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-zinc-600">
                            <span className="inline-flex items-center gap-1.5 font-mono font-medium text-zinc-800 tabular-nums">
                              <Clock
                                className="h-3.5 w-3.5 text-zinc-400"
                                aria-hidden="true"
                              />
                              {deadline.due_date} · {deadline.due_time}
                            </span>
                            <span className="text-zinc-500">
                              {deadline.target_branches.join(", ")} · Sem{" "}
                              {deadline.target_semesters.length === 8
                                ? "All"
                                : deadline.target_semesters.join(", ")}
                            </span>
                          </div>

                          {/* Penalty Chip */}
                          <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200/80 bg-rose-50/80 px-3 py-1.5 text-xs font-medium text-rose-800">
                            <AlertOctagon
                              className="h-3.5 w-3.5 shrink-0 text-rose-600"
                              aria-hidden="true"
                            />
                            <span>{deadline.penalty_impact}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right Actions */}
                      <div className="flex shrink-0 flex-wrap items-center gap-2 pl-9 sm:flex-col sm:items-end sm:pl-0">
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
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
                        >
                          <CalendarPlus
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Add .ics
                        </button>

                        {deadline.action_url && (
                          <a
                            href={deadline.action_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#1E3A5F] hover:underline"
                          >
                            Open ERP
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

        {/* Right: Live Alert Timeline (4 cols) */}
        <aside className="space-y-3.5 lg:col-span-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-800">
              <BellRing
                className="h-4 w-4 text-[#1E3A5F]"
                aria-hidden="true"
              />
              Live Alert Stream
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 tabular-nums">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {alertLogs.length} events
            </span>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            {alertLogs.length === 0 ? (
              <p className="text-xs text-zinc-500">
                No alerts dispatched yet.
              </p>
            ) : (
              <div className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-zinc-200">
                {alertLogs.slice(0, 10).map((alert) => (
                  <div key={alert.id} className="relative pl-6">
                    <span
                      className={`absolute top-1.5 left-0 h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ${
                        alert.channel === "webhook"
                          ? "bg-emerald-500 ring-emerald-200"
                          : "bg-[#1E3A5F] ring-zinc-200"
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onInspectCircular(alert.notice_id)}
                        className="cursor-pointer font-mono text-xs font-semibold text-[#1E3A5F] hover:underline"
                      >
                        {alert.circular_no}
                      </button>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 uppercase">
                        {alert.channel === "webhook" ? "Webhook" : "In-App"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-700">
                      {alert.message}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400 tabular-nums">
                      {new Date(alert.sent_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function StatPill({
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
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
        : "border-zinc-200 bg-white text-zinc-800";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs shadow-2xs ${styles}`}
    >
      <span className="font-bold tabular-nums">{value}</span>
      <span className="font-medium opacity-80">{label}</span>
    </div>
  );
}

function CountdownPill({
  label,
  tone,
}: {
  label: string;
  tone: "overdue" | "soon" | "upcoming" | "done";
}) {
  if (tone === "done") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
        Completed
      </span>
    );
  }
  if (tone === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 tabular-nums">
        {label}
      </span>
    );
  }
  if (tone === "soon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 tabular-nums">
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-[#1E3A5F] tabular-nums">
      {label}
    </span>
  );
}

function UrgencyPill({ urgency }: { urgency: Deadline["urgency"] }) {
  if (urgency === "critical") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2.5 py-0.5 text-[11px] font-semibold text-white">
        Critical
      </span>
    );
  }
  if (urgency === "high") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
        High Priority
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600">
      Normal
    </span>
  );
}
