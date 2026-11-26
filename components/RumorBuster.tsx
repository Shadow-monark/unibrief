"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  SearchCheck,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import type { Notice, VerifyRumorResponse } from "@/types/campus";

interface RumorBusterProps {
  notices: Notice[];
  onInspectCircular: (noticeId: string) => void;
  onToast: (message: string, tone?: "success" | "error" | "info") => void;
}

const DEMO_RUMORS = [
  {
    label: "Mid-Sem Date Rumor (Outdated)",
    text: "Guys confirm news: Sem 3 Mid-Sem starts 28 Nov!",
  },
  {
    label: "Sudden Holiday Forward (Fake)",
    text: "Kal college mein sudden holiday declare ho gaya hai!",
  },
  {
    label: "Medical Relaxation Check (Verified)",
    text: "Medical grounds pe 65% attendance pe exam de sakte hain?",
  },
];

export function RumorBuster({
  notices,
  onInspectCircular,
  onToast,
}: RumorBusterProps) {
  const [claim, setClaim] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyRumorResponse | null>(null);

  async function verifyClaim(textToCheck: string) {
    const clean = textToCheck.trim();
    if (!clean || loading) return;

    setClaim(clean);
    setLoading(true);
    try {
      const res = await fetch("/api/verify-rumor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claim: clean }),
      });
      const data = (await res.json()) as VerifyRumorResponse & {
        error?: string;
      };
      if (!res.ok) {
        onToast(data.error || "Rumor verification failed.", "error");
        return;
      }
      setResult(data);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Failed to verify claim.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-sm border border-[#CBD5E1] bg-white p-5 sm:p-6">
        <div className="max-w-3xl">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-[#0F172A]">
            WhatsApp Rumor Buster
          </h1>
          <p className="mt-1 text-sm text-[#475569]">
            Paste any forwarded campus WhatsApp message, rumor, or unverified
            screenshot text. AskCampus cross-checks it against all{" "}
            <span className="font-mono font-semibold text-[#0F172A]">
              {notices.length}
            </span>{" "}
            active and superseded official circulars.
          </p>
        </div>

        {/* One-Click Demo Presets */}
        <div className="mt-4 flex flex-wrap gap-2">
          {DEMO_RUMORS.map((preset) => (
            <button
              key={preset.text}
              type="button"
              disabled={loading}
              onClick={() => verifyClaim(preset.text)}
              className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-3 py-1.5 text-left text-xs font-medium text-[#1E3A5F] hover:border-[#1E3A5F] hover:bg-white disabled:opacity-50"
            >
              <span className="font-semibold">{preset.label}:</span>{" "}
              <span className="text-[#334155]">&ldquo;{preset.text}&rdquo;</span>
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyClaim(claim);
          }}
          className="mt-4 space-y-3"
        >
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#475569]">
            Forwarded Claim or Message
            <textarea
              rows={3}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="Paste WhatsApp forward here..."
              className="mt-1.5 w-full rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-3 text-sm text-[#0F172A] placeholder:text-[#64748B]"
            />
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !claim.trim()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-sm bg-[#1E3A5F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#162C49] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <SearchCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Verify Against Official Circulars</span>
            </button>
          </div>
        </form>
      </section>

      {/* Verdict Display */}
      {result && (
        <section className="rounded-sm border border-[#CBD5E1] bg-white p-6">
          <VerdictBanner result={result} />

          <p className="mt-4 text-sm leading-relaxed text-[#0F172A]">
            {result.explanation}
          </p>

          {(result.active_circular_ref || result.outdated_circular_ref) && (
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              {result.outdated_circular_ref && (
                <span className="rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2.5 py-1 font-mono font-medium text-[#92400E]">
                  Outdated Ref: {result.outdated_circular_ref}
                </span>
              )}
              {result.active_circular_ref && (
                <span className="rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2.5 py-1 font-mono font-medium text-[#166534]">
                  Active Official Ref: {result.active_circular_ref}
                </span>
              )}
            </div>
          )}

          {/* Citation Cards */}
          {result.citations.length > 0 && (
            <div className="mt-5 space-y-2.5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#475569]">
                Supporting Source Circulars
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {result.citations.map((cit, idx) => (
                  <button
                    key={`${cit.notice_id}-${idx}`}
                    type="button"
                    onClick={() => onInspectCircular(cit.notice_id)}
                    className="group cursor-pointer rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] p-4 text-left transition-colors hover:border-[#1E3A5F] hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                        {cit.circular_no} · Page {cit.page}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#475569] group-hover:text-[#1E3A5F]">
                        Inspect
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                      {cit.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#475569]">
                      &ldquo;{cit.excerpt}&rdquo;
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function VerdictBanner({ result }: { result: VerifyRumorResponse }) {
  if (result.verdict === "VERIFIED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] p-4">
        <div className="flex items-center gap-3">
          <ShieldCheck
            className="h-6 w-6 shrink-0 text-[#166534]"
            aria-hidden="true"
          />
          <div>
            <span className="inline-block rounded-sm bg-[#166534] px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white">
              VERIFIED
            </span>
            <h2 className="mt-1 font-serif text-lg font-semibold text-[#166534]">
              {result.headline}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (result.verdict === "OUTDATED") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle
            className="h-6 w-6 shrink-0 text-[#92400E]"
            aria-hidden="true"
          />
          <div>
            <span className="inline-block rounded-sm bg-[#B45309] px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white">
              OUTDATED
            </span>
            <h2 className="mt-1 font-serif text-lg font-semibold text-[#92400E]">
              {result.headline}
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#FCA5A5] bg-[#FEF2F2] p-4">
      <div className="flex items-center gap-3">
        <ShieldX
          className="h-6 w-6 shrink-0 text-[#991B1B]"
          aria-hidden="true"
        />
        <div>
          <span className="inline-block rounded-sm bg-[#991B1B] px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-white">
            UNVERIFIED RUMOR
          </span>
          <h2 className="mt-1 font-serif text-lg font-semibold text-[#991B1B]">
            {result.headline}
          </h2>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 font-mono text-xs text-[#991B1B]">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        Do Not Forward
      </span>
    </div>
  );
}
