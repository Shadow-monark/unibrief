"use client";

import { useState } from "react";
import {
  Bell,
  CalendarPlus,
  Check,
  ChevronDown,
  ExternalLink,
  FileCheck2,
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
  const [alertsOpen, setAlertsOpen] = useState(false);

  const activeDeadlines = filterDeadlinesForProfile(deadlines, profile, false);
  const pendingCount = activeDeadlines.filter((d) => !d.completed).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Calm Minimal Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Semester Radar
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            {pendingCount === 0
              ? `All clear for ${profile.branch} Sem ${profile.semester}.`
              : `${pendingCount} upcoming item${pendingCount === 1 ? "" : "s"} for ${
                  profile.branch === "All" ? "All Branches" : profile.branch
                } · Sem ${profile.semester} · ${profile.residence}`}
          </p>
        </div>

        {/* Quiet Collapsible Alerts Toggle */}
        <button
          type="button"
          onClick={() => setAlertsOpen((v) => !v)}
          aria-expanded={alertsOpen}
          className="glass-card inline-flex cursor-pointer items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-700 transition"
        >
          <Bell className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
          <span>Alerts ({alertLogs.length})</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
              alertsOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Collapsible Glass Alert Feed */}
      {alertsOpen && (
        <section className="glass-panel rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Recent Campus Updates
            </h2>
            <span className="text-xs text-slate-400">Synced automatically</span>
          </div>
          <div className="space-y-2.5">
            {alertLogs.slice(0, 6).map((alert) => (
              <div
                key={alert.id}
                className="flex flex-col justify-between gap-1.5 rounded-2xl bg-white/60 px-4 py-3 text-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => onInspectCircular(alert.notice_id)}
                    className="cursor-pointer font-mono font-semibold text-[#1E3A5F] hover:underline"
                  >
                    {alert.circular_no}
                  </button>
                  <p className="text-slate-700">{alert.message}</p>
                </div>
                <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                  {new Date(alert.sent_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Calm Frosted Deadline Cards */}
      {activeDeadlines.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center">
          <FileCheck2
            className="mx-auto h-9 w-9 text-slate-400"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-semibold text-slate-800">
            Nothing due for {profile.branch} Semester {profile.semester}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Switch profile filters or upload a circular in Admin.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          {activeDeadlines.map((deadline) => {
            const countdown = getDeadlineCountdown(deadline.due_date);
            const notice = notices.find((n) => n.id === deadline.notice_id);
            const isToggling = togglingId === deadline.id;

            return (
              <article
                key={deadline.id}
                className={`glass-card rounded-3xl p-5 transition-all duration-200 sm:p-6 ${
                  deadline.completed ? "opacity-60" : ""
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Check + Title + Concise Subtitle */}
                  <div className="flex items-start gap-4 min-w-0">
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
                          : "border-slate-300 bg-white/80 text-transparent hover:border-slate-900"
                      } disabled:opacity-50`}
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    <div className="min-w-0 space-y-1.5">
                      <h2
                        className={`text-base font-semibold tracking-tight ${
                          deadline.completed
                            ? "text-slate-500 line-through"
                            : "text-slate-900"
                        }`}
                      >
                        {deadline.title}
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                        <span className="font-medium text-slate-700 tabular-nums">
                          {deadline.due_date} · {deadline.due_time}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className={
                            deadline.urgency === "critical" &&
                            !deadline.completed
                              ? "font-medium text-rose-700"
                              : "text-slate-500"
                          }
                        >
                          {deadline.penalty_impact}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Minimal Status + Calendar + Circular */}
                  <div className="flex shrink-0 flex-wrap items-center gap-2 pl-10 sm:pl-0">
                    <CountdownPill
                      label={deadline.completed ? "Done" : countdown.label}
                      tone={deadline.completed ? "done" : countdown.tone}
                    />

                    <button
                      type="button"
                      onClick={() => onInspectCircular(deadline.notice_id)}
                      className="cursor-pointer rounded-full bg-white/80 px-3 py-1 font-mono text-[11px] font-medium text-slate-600 ring-1 ring-slate-200/80 transition hover:bg-white hover:text-slate-900"
                    >
                      {deadline.circular_no}
                    </button>

                    <button
                      type="button"
                      title="Save reminder (.ics)"
                      aria-label={`Download calendar reminder for ${deadline.title}`}
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
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/85 text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-900 hover:text-white"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>

                    {deadline.action_url && (
                      <a
                        href={deadline.action_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open portal for ${deadline.title}`}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/85 text-slate-700 ring-1 ring-slate-200/80 transition hover:bg-slate-900 hover:text-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
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
  );
}

function CountdownPill({
  label,
  tone,
}: {
  label: string;
  tone: "overdue" | "soon" | "upcoming" | "done";
}) {
  const styles =
    tone === "done"
      ? "bg-emerald-500/10 text-emerald-800"
      : tone === "overdue"
        ? "bg-rose-500/12 text-rose-800"
        : tone === "soon"
          ? "bg-amber-500/15 text-amber-900"
          : "bg-slate-900/8 text-slate-700";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold tabular-nums ${styles}`}
    >
      {label}
    </span>
  );
}
