"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Mail,
  ShieldAlert,
} from "lucide-react";
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

  // SVG Radial Gauge math
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
    <div className="space-y-6">
      {/* Header + Live Ordinance Pill */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Attendance &amp; Rulebook Simulator
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Live eligibility calculator powered directly by active university
            policy parameters.
          </p>
        </div>

        {policyNotice && (
          <button
            type="button"
            onClick={() => onInspectCircular(policyNotice.id)}
            className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-zinc-200 bg-white px-4 py-1.5 font-mono text-xs font-semibold text-[#1E3A5F] shadow-2xs transition hover:border-zinc-400"
          >
            Ordinance: {policyNotice.circular_no} · Clause {rules.clause}
          </button>
        )}
      </div>

      {/* Main 2-Column Simulator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Interactive Controls + Policy Rules (5 cols) */}
        <section className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-5">
          <div className="space-y-5">
            <h2 className="text-base font-bold text-zinc-900">
              Your Class Attendance
            </h2>

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

          {/* Dynamic Ordinance Pills */}
          <div className="grid grid-cols-2 gap-2.5 border-t border-zinc-100 pt-5">
            <RuleMiniCard
              label="Mandatory Min"
              value={`${rules.min_attendance}%`}
            />
            <RuleMiniCard
              label={`Medical Floor (Cl. ${rules.clause})`}
              value={`${rules.medical_min}%`}
            />
            <RuleMiniCard
              label="Submission Window"
              value={`${rules.submission_days} working days`}
            />
            <RuleMiniCard
              label="Auto-Detention"
              value={`< ${rules.medical_min}%`}
            />
          </div>
        </section>

        {/* Right: Visual SVG Gauge + Zone Guidance (7 cols) */}
        <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-7">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            {/* Radial Gauge */}
            <div className="relative flex h-44 w-44 shrink-0 items-center justify-center">
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
                  stroke="#f4f4f5"
                  strokeWidth="14"
                />
                <circle
                  cx="90"
                  cy="90"
                  r={radius}
                  fill="none"
                  stroke={ringStroke}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-bold tracking-tight text-zinc-900 tabular-nums">
                  {currentPct.toFixed(1)}%
                </span>
                <span className="mt-0.5 text-xs font-medium text-zinc-500 tabular-nums">
                  {safeAttended} / {safeHeld}
                </span>
              </div>
            </div>

            {/* Key Projection Cards */}
            <div className="grid w-full flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="text-xs font-medium text-zinc-500">
                  {zone === "safe"
                    ? "Safe Bunk Buffer"
                    : `Needed for ${rules.min_attendance}%`}
                </div>
                <div className="mt-1 text-2xl font-bold text-zinc-900 tabular-nums">
                  {zone === "safe" ? `${bunkBuffer} classes` : `${neededForMin} classes`}
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {zone === "safe"
                    ? `skippable above ${rules.min_attendance}%`
                    : "consecutive attendance needed"}
                </div>
              </div>

              <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4">
                <div className="text-xs font-medium text-zinc-500">
                  Projected (+{safeUpcoming} classes)
                </div>
                <div className="mt-1 text-2xl font-bold text-zinc-900 tabular-nums">
                  {projectedPct.toFixed(1)}%
                </div>
                <div className="mt-0.5 text-xs text-zinc-500 tabular-nums">
                  {safeAttended + safeUpcoming} / {safeHeld + safeUpcoming}{" "}
                  attended
                </div>
              </div>
            </div>
          </div>

          {/* Zone Status Card */}
          {zone === "safe" && (
            <div className="flex items-start gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 text-emerald-950">
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold">
                  Eligible for End-Sem Exams (Safe Zone)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                  You satisfy the {rules.min_attendance}% mandate and can safely
                  miss up to <strong>{bunkBuffer}</strong> upcoming class
                  {bunkBuffer === 1 ? "" : "es"}.
                </p>
              </div>
            </div>
          )}

          {zone === "medical" && (
            <div className="space-y-3.5 rounded-xl border border-amber-200 bg-amber-50/80 p-5 text-amber-950">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-sm font-bold">
                    Medical Relaxation Zone ({rules.medical_min}%–
                    {(rules.min_attendance - 0.1).toFixed(1)}% · Clause{" "}
                    {rules.clause})
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-amber-900">
                    Attend <strong>{neededForMin}</strong> consecutive classes
                    to hit {rules.min_attendance}%, or submit an HOD Medical
                    Condonation Appeal under{" "}
                    <span className="font-mono font-semibold">
                      {circularRef} Clause {rules.clause}
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/90 bg-white p-4 text-xs text-zinc-800">
                <div className="inline-flex items-center gap-1.5 font-semibold text-amber-900">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Required Checklist ({rules.submission_days}-day submission rule)
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-600">
                  <li>
                    Registered doctor certificate (MCI/NMC registration no.)
                  </li>
                  <li>Diagnostic reports &amp; prescription copy</li>
                  <li>
                    Submit to HOD within{" "}
                    <strong>{rules.submission_days} working days</strong> of
                    resuming classes
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={openMedicalAppealMail}
                  className="mt-3.5 inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0F172A] px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate HOD Medical Appeal Mail
                </button>
              </div>
            </div>
          )}

          {zone === "detention" && (
            <div className="flex items-start gap-3.5 rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-rose-950">
              <ShieldAlert
                className="mt-0.5 h-5 w-5 shrink-0 text-rose-600"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-bold">
                  Detention Risk Zone (Below {rules.medical_min}%)
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-rose-900">
                  Under {circularRef}, below {rules.medical_min}% triggers
                  academic detention even on medical grounds. You need{" "}
                  <strong>{neededForMedical}</strong> consecutive classes to
                  reach {rules.medical_min}% and <strong>{neededForMin}</strong>{" "}
                  to reach {rules.min_attendance}%.
                </p>
              </div>
            </div>
          )}
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
      <div className="flex items-center justify-between text-xs font-medium text-zinc-700">
        <span>{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-right font-mono text-xs font-semibold text-zinc-900 tabular-nums focus:border-zinc-400 focus:bg-white focus:outline-none"
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

function RuleMiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
      <div className="text-[11px] font-medium text-zinc-500">{label}</div>
      <div className="mt-0.5 font-mono text-xs font-semibold text-zinc-900 tabular-nums">
        {value}
      </div>
    </div>
  );
}
