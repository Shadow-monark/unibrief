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
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/35 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-mail-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl sm:rounded-l-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-2.5 py-0.5 font-mono text-xs font-medium text-white">
                <Mail className="h-3 w-3" aria-hidden="true" />
                {draft.cited_circular_no}
              </span>
              {draft.cited_clause && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                  Clause {draft.cited_clause}
                </span>
              )}
            </div>
            <h2
              id="draft-mail-title"
              className="mt-2.5 text-xl font-bold tracking-tight text-zinc-900"
            >
              Draft Official Email
            </h2>
            <p className="text-xs text-zinc-500">
              Recipient:{" "}
              <span className="font-semibold text-zinc-800">
                {draft.recipient_role}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close email draft modal"
            className="cursor-pointer rounded-full border border-zinc-200 bg-white p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-3 rounded-xl bg-zinc-50 p-4 sm:grid-cols-3">
            <label className="block text-xs font-medium text-zinc-700">
              Student Name
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Roll No
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
              />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Section
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-1.5 font-mono text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-zinc-500">Subject</span>
            <div className="mt-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm font-semibold text-zinc-900">
              {draft.subject}
            </div>
          </div>

          <div>
            <span className="text-xs font-semibold text-zinc-500">
              Email Body (Auto-Cited)
            </span>
            <pre className="mt-1.5 whitespace-pre-wrap rounded-xl border border-zinc-200 bg-white p-4 font-sans text-sm leading-relaxed text-zinc-800">
              {compiledBody}
            </pre>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 px-6 py-4">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-900"
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
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0F172A] px-5 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Open in Mail App
          </a>
        </div>
      </div>
    </div>
  );
}
