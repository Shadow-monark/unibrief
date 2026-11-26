"use client";

import { useMemo, useState } from "react";
import { Mail } from "lucide-react";
import { getActiveAttendancePolicy } from "@/lib/profile";
import type { Notice, StudentProfile, SuggestedEmail } from "@/types/campus";

interface RuleSimulatorProps {
  notices: Notice[];
  profile: StudentProfile;
  onInspectCircular: (noticeId: string) => void;
  onDraftEmail: (email: SuggestedEmail) => void;
}

function consecutiveClassesNeeded(
  held: number,
  attended: number,
  targetPct: number
): number {
  const ratio = targetPct / 100;
  if (held <= 0 || attended / held >= ratio || ratio >= 1) return 0;
  return Math.max(0, Math.ceil((ratio * held - attended) / (1 - ratio)));
}

function safeBunkBuffer(
  held: number,
  attended: number,
  targetPct: number
): number {
  const ratio = targetPct / 100;
  if (held <= 0 || attended / held < ratio || ratio <= 0) return 0;
  return Math.max(0, Math.floor(attended / ratio - held));
}

export function RuleSimulator({
  notices,
  profile,
  onInspectCircular,
  onDraftEmail,
}: RuleSimulatorProps) {
  const { notice: policyNotice, rules } = useMemo(
    () => getActiveAttendancePolicy(notices),
    [notices]
  );

  const [totalHeld, setTotalHeld] = useState(40);
  const [attended, setAttended] = useState(28);
  const [upcoming, setUpcoming] = useState(10);

  const safeHeld = Math.max(1, totalHeld);
  const safeAttended = Math.min(safeHeld, Math.max(0, attended));
  const safeUpcoming = Math.max(0, upcoming);

  const currentPct = (safeAttended / safeHeld) * 100;
  const projectedPct =
    ((safeAttended + safeUpcoming) / (safeHeld + safeUpcoming)) * 100;

  const neededForMin = consecutiveClassesNeeded(
    safeHeld,
    safeAttended,
    rules.min_attendance
  );
  const neededForMedical = consecutiveClassesNeeded(
    safeHeld,
    safeAttended,
    rules.medical_min
  );
  const bunkBuffer = safeBunkBuffer(
    safeHeld,
    safeAttended,
    rules.min_attendance
  );

  const zone: "safe" | "medical" | "detention" =
    currentPct >= rules.min_attendance
      ? "safe"
      : currentPct >= rules.medical_min
        ? "medical"
        : "detention";

  const circularRef = policyNotice?.circular_no ?? "ACAD/2026/041";

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.min(100, Math.max(0, currentPct));
  const dashOffset = circumference - (clampedPct / 100) * circumference;

  const ringStroke =
    zone === "safe" ? "#16a34a" : zone === "medical" ? "#d97706" : "#e11d48";

  function openMedicalAppealMail() {
    onDraftEmail({
      subject: `Medical Attendance Condonation Request under Clause ${rules.clause} (${circularRef})`,
      recipient_role: `Head of Department (${profile.branch === "All" ? "Department" : profile.branch})`,
      cited_circular_no: circularRef,
      cited_clause: rules.clause,
      body_template: `Respected Sir/Madam,

I am [Student Name] (Roll No: [Roll No]), a student of ${profile.branch === "All" ? "B.Tech" : profile.branch} Semester ${profile.semester} (Section [Section]).

My current aggregate attendance stands at ${currentPct.toFixed(1)}% (${safeAttended} out of ${safeHeld} classes), which falls within the ${rules.medical_min}%–${(rules.min_attendance - 0.1).toFixed(1)}% Medical Relaxation Zone defined under Clause ${rules.clause} of University Ordinance ${circularRef}.

Due to documented medical illness, I was unable to attend classes during the affected period. In compliance with the ${rules.submission_days}-working-day submission mandate, I am enclosing my registered medical practitioner's certificate (with registration number) and supporting diagnostic reports for kind consideration and condonation.

Thanking you.

Yours sincerely,
[Student Name]
Roll No: [Roll No] | Sem ${profile.semester} (${profile.branch})`,
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Attendance Simulator
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Live thresholds synced from active campus policy.
          </p>
        </div>

        {policyNotice && (
          <button
            type="button"
            onClick={() => onInspectCircular(policyNotice.id)}
            className="glass-card cursor-pointer rounded-full px-3.5 py-1.5 font-mono text-xs font-semibold text-[#1E3A5F]"
          >
            {policyNotice.circular_no} · Clause {rules.clause}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Left: Serene Gauge + Verdict (6 cols) */}
        <section className="glass-panel flex flex-col items-center justify-between gap-5 rounded-3xl p-7 text-center md:col-span-6">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <svg
              viewBox="0 0 180 180"
              className="h-full w-full -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke="rgba(15,23,42,0.07)"
                strokeWidth="12"
              />
              <circle
                cx="90"
                cy="90"
                r={radius}
                fill="none"
                stroke={ringStroke}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                className="transition-all duration-300"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
                {currentPct.toFixed(1)}%
              </span>
              <span className="text-xs text-slate-500 tabular-nums">
                {safeAttended} of {safeHeld} classes
              </span>
            </div>
          </div>

          {zone === "safe" && (
            <div className="space-y-1.5">
              <span className="inline-block rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-800">
                Safe Zone (≥ {rules.min_attendance}%)
              </span>
              <p className="text-sm text-slate-700">
                You can safely miss{" "}
                <strong className="text-slate-900">{bunkBuffer}</strong> more
                class{bunkBuffer === 1 ? "" : "es"}.
              </p>
            </div>
          )}

          {zone === "medical" && (
            <div className="space-y-3">
              <span className="inline-block rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-900">
                Medical Zone ({rules.medical_min}%–{(rules.min_attendance - 0.1).toFixed(1)}%)
              </span>
              <p className="text-xs leading-relaxed text-slate-700">
                Attend <strong>{neededForMin}</strong> consecutive classes to
                reach {rules.min_attendance}%, or submit doctor certificate
                within <strong>{rules.submission_days} working days</strong>{" "}
                under Clause {rules.clause}.
              </p>
              <button
                type="button"
                onClick={openMedicalAppealMail}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                Generate HOD Medical Appeal Mail
              </button>
            </div>
          )}

          {zone === "detention" && (
            <div className="space-y-1.5">
              <span className="inline-block rounded-full bg-rose-500/12 px-3 py-1 text-xs font-semibold text-rose-800">
                Detention Risk (&lt; {rules.medical_min}%)
              </span>
              <p className="text-xs leading-relaxed text-slate-700">
                Attend <strong>{neededForMedical}</strong> consecutive classes
                for {rules.medical_min}% or <strong>{neededForMin}</strong> for{" "}
                {rules.min_attendance}%.
              </p>
            </div>
          )}
        </section>

        {/* Right: Calm Sliders + Projection (6 cols) */}
        <section className="glass-panel flex flex-col justify-between gap-6 rounded-3xl p-7 md:col-span-6">
          <div className="space-y-5">
            <SliderNumberField
              label="Total Classes Held"
              value={safeHeld}
              min={1}
              max={200}
              onChange={(val) => {
                const clamped = Math.max(1, val);
                setTotalHeld(clamped);
                if (attended > clamped) setAttended(clamped);
              }}
            />

            <SliderNumberField
              label="Classes Attended"
              value={safeAttended}
              min={0}
              max={safeHeld}
              onChange={(val) =>
                setAttended(Math.min(safeHeld, Math.max(0, val)))
              }
            />

            <SliderNumberField
              label="Upcoming Classes Planned"
              value={safeUpcoming}
              min={0}
              max={60}
              onChange={(val) => setUpcoming(Math.max(0, val))}
            />
          </div>

          <div className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-xs">
            <span className="text-slate-600">
              Projected if next {safeUpcoming} attended
            </span>
            <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
              {projectedPct.toFixed(1)}%
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function SliderNumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
        <span>{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-16 rounded-full bg-white/85 px-2.5 py-1 text-right font-mono text-xs font-semibold text-slate-900 tabular-nums ring-1 ring-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="campus-slider w-full cursor-pointer"
      />
    </label>
  );
}
