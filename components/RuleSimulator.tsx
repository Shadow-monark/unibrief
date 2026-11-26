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
  if (held <= 0 || attended / held >= ratio) return 0;
  if (ratio >= 1) return 0;
  // (attended + x) / (held + x) >= ratio  =>  x >= (ratio * held - attended) / (1 - ratio)
  return Math.max(0, Math.ceil((ratio * held - attended) / (1 - ratio)));
}

function safeBunkBuffer(
  held: number,
  attended: number,
  targetPct: number
): number {
  const ratio = targetPct / 100;
  if (held <= 0 || attended / held < ratio || ratio <= 0) return 0;
  // attended / (held + b) >= ratio  =>  b <= attended / ratio - held
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
      {/* Header + Dynamic Ordinance Banner */}
      <section className="rounded-sm border border-[#CBD5E1] bg-white p-5 sm:p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#0F172A]">
              Dynamic Attendance &amp; Rulebook Simulator
            </h1>
            <p className="mt-1 text-sm text-[#475569]">
              Thresholds are dynamically read from active university policy
              records—never hardcoded.
            </p>
          </div>

          {policyNotice && (
            <button
              type="button"
              onClick={() => onInspectCircular(policyNotice.id)}
              className="inline-flex cursor-pointer items-center gap-2 self-start rounded-sm border border-[#1E3A5F] bg-[#EFF2F6] px-3 py-1.5 font-mono text-xs font-semibold text-[#1E3A5F] hover:bg-white"
            >
              Active Policy: {policyNotice.circular_no} (Clause {rules.clause})
            </button>
          )}
        </div>

        {/* Dynamic Policy Thresholds Strip */}
        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] p-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-[#475569]">Mandatory Minimum</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-[#0F172A] tabular-nums">
              {rules.min_attendance}%
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#475569]">Medical Relaxation Floor</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-[#92400E] tabular-nums">
              {rules.medical_min}% (Clause {rules.clause})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#475569]">Certificate Window</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-[#0F172A] tabular-nums">
              Within {rules.submission_days} working days
            </dd>
          </div>
          <div>
            <dt className="text-xs text-[#475569]">Auto-Detention Below</dt>
            <dd className="mt-0.5 font-mono text-base font-semibold text-[#991B1B] tabular-nums">
              &lt; {rules.medical_min}%
            </dd>
          </div>
        </dl>
      </section>

      {/* Simulator Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Controls (5 cols) */}
        <section className="space-y-5 rounded-sm border border-[#CBD5E1] bg-white p-5 lg:col-span-5">
          <h2 className="font-serif text-lg font-semibold text-[#0F172A]">
            Lecture &amp; Attendance Inputs
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
            onChange={(val) => setAttended(Math.min(safeHeld, Math.max(0, val)))}
          />

          <SliderNumberField
            label="Upcoming Classes Planned (100% attended)"
            value={safeUpcoming}
            min={0}
            max={60}
            onChange={(val) => setUpcoming(Math.max(0, val))}
          />
        </section>

        {/* Right: Live Result & Action Panel (7 cols) */}
        <section className="space-y-4 rounded-sm border border-[#CBD5E1] bg-white p-5 lg:col-span-7">
          {/* Status Banner */}
          {zone === "safe" && (
            <div className="flex items-start gap-3 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] p-4 text-[#166534]">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">
                  Eligible for End-Semester Examinations (Safe Zone)
                </h2>
                <p className="mt-1 text-xs leading-relaxed">
                  You meet the {rules.min_attendance}% threshold. You can safely
                  miss up to{" "}
                  <strong className="font-mono">{bunkBuffer}</strong> upcoming
                  class{bunkBuffer === 1 ? "" : "es"} without dropping below{" "}
                  {rules.min_attendance}%.
                </p>
              </div>
            </div>
          )}

          {zone === "medical" && (
            <div className="space-y-3 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] p-4 text-[#92400E]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold">
                    Medical Relaxation Zone ({rules.medical_min}%–
                    {(rules.min_attendance - 0.1).toFixed(1)}% · Clause{" "}
                    {rules.clause})
                  </h2>
                  <p className="mt-1 text-xs leading-relaxed">
                    You need{" "}
                    <strong className="font-mono">{neededForMin}</strong>{" "}
                    consecutive classes to recover to {rules.min_attendance}%, OR
                    you may apply for HOD medical condonation under{" "}
                    <span className="font-mono font-semibold">
                      {circularRef} Clause {rules.clause}
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className="rounded-sm border border-[#FCD34D] bg-white p-3 text-xs text-[#0F172A]">
                <div className="inline-flex items-center gap-1.5 font-semibold text-[#92400E]">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Required Documents Checklist ({rules.submission_days}-day rule)
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[#334155]">
                  <li>
                    Original Medical Certificate from a registered doctor
                    (MCI/NMC registration number visible)
                  </li>
                  <li>Supporting diagnostic reports &amp; prescription</li>
                  <li>
                    Submit formal appeal to HOD within{" "}
                    <strong>{rules.submission_days} working days</strong> of
                    resuming classes
                  </li>
                </ul>
                <button
                  type="button"
                  onClick={openMedicalAppealMail}
                  className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-sm bg-[#1E3A5F] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#162C49]"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  Generate HOD Medical Appeal Mail
                </button>
              </div>
            </div>
          )}

          {zone === "detention" && (
            <div className="flex items-start gap-3 rounded-sm border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-[#991B1B]">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">
                  Detention Risk Zone (Below {rules.medical_min}%)
                </h2>
                <p className="mt-1 text-xs leading-relaxed">
                  Under {circularRef}, attendance below {rules.medical_min}%
                  triggers academic detention even with medical certificates. You
                  need{" "}
                  <strong className="font-mono">{neededForMedical}</strong>{" "}
                  consecutive classes to enter the {rules.medical_min}% Medical
                  Zone and{" "}
                  <strong className="font-mono">{neededForMin}</strong> to reach{" "}
                  {rules.min_attendance}%.
                </p>
              </div>
            </div>
          )}

          {/* Readouts Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatReadout
              label="Current Percentage"
              value={`${currentPct.toFixed(1)}%`}
              sub={`${safeAttended}/${safeHeld} classes`}
            />
            <StatReadout
              label={`If Next ${safeUpcoming} Attended`}
              value={`${projectedPct.toFixed(1)}%`}
              sub={`${safeAttended + safeUpcoming}/${safeHeld + safeUpcoming} projected`}
            />
            <StatReadout
              label={
                zone === "safe"
                  ? "Safe Bunk Buffer"
                  : `Classes to ${rules.min_attendance}%`
              }
              value={zone === "safe" ? `${bunkBuffer}` : `${neededForMin}`}
              sub={
                zone === "safe"
                  ? "classes skippable"
                  : "consecutive classes needed"
              }
            />
          </div>

          {/* Visual Threshold Bar */}
          <div className="rounded-sm border border-[#E2E8F0] bg-[#F7F8FA] p-4">
            <div className="flex items-center justify-between text-xs text-[#475569]">
              <span>0%</span>
              <span className="font-mono">
                Medical Floor ({rules.medical_min}%)
              </span>
              <span className="font-mono">
                Mandatory ({rules.min_attendance}%)
              </span>
              <span>100%</span>
            </div>
            <div className="relative mt-2 h-3 w-full overflow-hidden rounded-xs border border-[#CBD5E1] bg-white">
              <div
                className={`h-full transition-all duration-200 ${
                  zone === "safe"
                    ? "bg-[#166534]"
                    : zone === "medical"
                      ? "bg-[#B45309]"
                      : "bg-[#991B1B]"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, currentPct))}%` }}
              />
            </div>
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
      <div className="flex items-center justify-between text-xs font-medium text-[#334155]">
        <span>{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-20 rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-2 py-1 text-right font-mono text-sm font-semibold text-[#0F172A] tabular-nums"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer accent-[#1E3A5F]"
      />
    </label>
  );
}

function StatReadout({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-3.5">
      <div className="text-xs text-[#475569]">{label}</div>
      <div className="mt-1 font-mono text-2xl font-semibold text-[#0F172A] tabular-nums">
        {value}
      </div>
      <div className="mt-0.5 font-mono text-[11px] text-[#475569]">{sub}</div>
    </div>
  );
}
