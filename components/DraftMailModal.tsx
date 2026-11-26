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
      className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-mail-title"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-[#CBD5E1] bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#CBD5E1] bg-[#F7F8FA] px-6 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-sm border border-[#1E3A5F] bg-[#1E3A5F] px-2 py-0.5 font-mono text-xs font-medium text-white">
                <Mail className="h-3 w-3" aria-hidden="true" />
                {draft.cited_circular_no}
              </span>
              {draft.cited_clause && (
                <span className="rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 font-mono text-xs font-medium text-[#166534]">
                  Clause {draft.cited_clause}
                </span>
              )}
            </div>
            <h2
              id="draft-mail-title"
              className="mt-2 font-serif text-xl font-semibold text-[#0F172A]"
            >
              Draft Official Email
            </h2>
            <p className="text-xs text-[#475569]">
              Recipient: <span className="font-medium text-[#0F172A]">{draft.recipient_role}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close email draft modal"
            className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-white p-1.5 text-[#475569] hover:bg-[#EFF2F6] hover:text-[#0F172A]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Student Details Inputs */}
          <div className="grid grid-cols-1 gap-3 rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-4 sm:grid-cols-3">
            <label className="block text-xs font-medium text-[#334155]">
              Student Name
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-sm text-[#0F172A]"
              />
            </label>
            <label className="block text-xs font-medium text-[#334155]">
              Roll No
              <input
                type="text"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#CBD5E1] bg-white px-2.5 py-1.5 font-mono text-sm text-[#0F172A]"
              />
            </label>
            <label className="block text-xs font-medium text-[#334155]">
              Section
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="mt-1 w-full rounded-sm border border-[#CBD5E1] bg-white px-2.5 py-1.5 font-mono text-sm text-[#0F172A]"
              />
            </label>
          </div>

          {/* Subject Preview */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-[#475569]">
              Subject
            </span>
            <div className="mt-1 rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-3 py-2 text-sm font-medium text-[#0F172A]">
              {draft.subject}
            </div>
          </div>

          {/* Body Preview */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-[#475569]">
              Email Body (Auto-Cited)
            </span>
            <pre className="mt-1 whitespace-pre-wrap rounded-sm border border-[#CBD5E1] bg-white p-4 font-sans text-sm leading-relaxed text-[#0F172A]">
              {compiledBody}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#CBD5E1] bg-[#F7F8FA] px-6 py-4">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-[#CBD5E1] bg-white px-4 py-2 text-sm font-semibold text-[#0F172A] hover:bg-[#EFF2F6]"
          >
            {copied ? (
              <Check className="h-4 w-4 text-[#166534]" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy Email"}
          </button>

          <a
            href={mailtoHref}
            className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162C49]"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Open in Mail App
          </a>
        </div>
      </div>
    </div>
  );
}
