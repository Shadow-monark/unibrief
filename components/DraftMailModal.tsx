"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, Send, X } from "lucide-react";
import type { StudentProfile, SuggestedEmail } from "@/types/campus";

interface DraftMailModalProps {
  draft: SuggestedEmail | null;
  profile: StudentProfile;
  onClose: () => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}

function interpolateEmailBody(
  template: string,
  studentName: string,
  rollNo: string,
  section: string,
  profile: StudentProfile
): string {
  const safeName = studentName.trim() || "[Student Name]";
  const safeRoll = rollNo.trim() || "[Roll No]";
  const safeSection = section.trim() || "[Section]";

  return template
    .replace(/\[Student Name\]/gi, safeName)
    .replace(/\[Name\]/gi, safeName)
    .replace(/\[Roll No(?:\.|umber)?\]/gi, safeRoll)
    .replace(/\[Section\]/gi, safeSection)
    .replace(/\[Branch\]/gi, profile.branch === "All" ? "B.Tech" : profile.branch)
    .replace(/\[Semester\]/gi, String(profile.semester));
}

export function DraftMailModal({
  draft,
  profile,
  onClose,
  onToast,
}: DraftMailModalProps) {
  const [studentName, setStudentName] = useState("Aarav Sharma");
  const [rollNo, setRollNo] = useState("25CSE041");
  const [section, setSection] = useState("A");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!draft) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [draft, onClose]);

  const compiledBody = useMemo(() => {
    if (!draft) return "";
    const base = interpolateEmailBody(
      draft.body_template,
      studentName,
      rollNo,
      section,
      profile
    );
    const hasSig =
      base.includes(studentName.trim()) && base.includes(rollNo.trim());
    if (hasSig) return base;
    return `${base}\n\nRegards,\n${studentName.trim() || "[Student Name]"}\nRoll No: ${rollNo.trim() || "[Roll No]"} | ${
      profile.branch === "All" ? "B.Tech" : profile.branch
    } Sem ${profile.semester} (Sec ${section.trim() || "A"})`;
  }, [draft, studentName, rollNo, section, profile]);

  if (!draft) return null;

  const mailtoHref = `mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(compiledBody)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        `Subject: ${draft?.subject ?? ""}\n\n${compiledBody}`
      );
      setCopied(true);
      onToast("Official email draft copied to clipboard.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast("Could not access clipboard. Select and copy manually.", "error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-mail-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-white/80 bg-white/85 backdrop-blur-2xl shadow-2xl sm:rounded-l-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200/60 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-medium text-white">
                <Mail className="h-3 w-3" aria-hidden="true" />
                {draft.cited_circular_no}
              </span>
              {draft.cited_clause && (
                <span className="rounded-full bg-emerald-500/12 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-800">
                  Clause {draft.cited_clause}
                </span>
              )}
            </div>
            <h2
              id="draft-mail-title"
              className="mt-2 text-lg font-bold tracking-tight text-slate-900"
            >
              Draft Official Email
            </h2>
            <p className="text-xs text-slate-500">
              To:{" "}
              <span className="font-semibold text-slate-800">
                {draft.recipient_role}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close email draft modal"
            className="cursor-pointer rounded-full bg-white/80 p-2 text-slate-500 ring-1 ring-slate-200/70 transition hover:bg-white hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 rounded-2xl bg-white/70 p-4 ring-1 ring-white sm:grid-cols-3">
            <label className="block text-xs font-medium text-slate-700">
              Student Name
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-white px-3 py-1.5 text-sm text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Roll No
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-white px-3 py-1.5 font-mono text-sm text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
            <label className="block text-xs font-medium text-slate-700">
              Section
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="mt-1.5 w-full rounded-xl bg-white px-3 py-1.5 font-mono text-sm text-slate-900 ring-1 ring-slate-200/80 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500">Subject</span>
            <div className="mt-1.5 rounded-2xl bg-white/75 px-4 py-2.5 text-sm font-semibold text-slate-900 ring-1 ring-white">
              {draft.subject}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-500">
              Email Body
            </span>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-2xl bg-white/80 p-4 font-sans text-sm leading-relaxed text-slate-800 ring-1 ring-white">
              {compiledBody}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 px-6 py-4">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 transition hover:bg-slate-50"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy Email"}
          </button>

          <a
            href={mailtoHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Open in Mail App
          </a>
        </div>
      </div>
    </div>
  );
}
