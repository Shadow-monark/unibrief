"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Forward,
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
    tag: "Schedule Rumor",
    text: "Guys confirm news: Sem 3 Mid-Sem starts 28 Nov!",
  },
  {
    tag: "WhatsApp Forward",
    text: "Kal college mein sudden holiday declare ho gaya hai!",
  },
  {
    tag: "Policy Check",
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
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
          WhatsApp Rumor Buster
        </h1>
        <p className="mx-auto mt-1.5 max-w-xl text-sm text-zinc-600">
          Fact-check any forwarded message against{" "}
          <span className="font-semibold text-zinc-900">
            {notices.length} active &amp; superseded
          </span>{" "}
          campus circulars in seconds.
        </p>
      </div>

      {/* Input Studio Card */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] sm:p-6">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {DEMO_RUMORS.map((preset) => (
            <button
              key={preset.text}
              type="button"
              disabled={loading}
              onClick={() => verifyClaim(preset.text)}
              className="group cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50/70 p-3.5 text-left transition hover:border-zinc-300 hover:bg-white hover:shadow-xs disabled:opacity-50"
            >
              <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500">
                <span className="inline-flex items-center gap-1 italic">
                  <Forward className="h-3 w-3" aria-hidden="true" />
                  Forwarded
                </span>
                <span className="font-semibold text-[#1E3A5F]">
                  {preset.tag}
                </span>
              </div>
              <p className="mt-1.5 text-xs font-medium leading-relaxed text-zinc-800">
                &ldquo;{preset.text}&rdquo;
              </p>
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
          <textarea
            rows={3}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            aria-label="Forwarded message or claim to verify"
            placeholder="Paste any campus WhatsApp forward or rumor here..."
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 text-sm text-zinc-900 placeholder:text-zinc-400 transition focus:border-zinc-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-zinc-100"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !claim.trim()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[#0F172A] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <SearchCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Verify Claim</span>
            </button>
          </div>
        </form>
      </section>

      {/* Verdict Card */}
      {result && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
          <VerdictBanner result={result} />

          <p className="mt-4 text-sm leading-relaxed text-zinc-700">
            {result.explanation}
          </p>

          {(result.active_circular_ref || result.outdated_circular_ref) && (
            <div className="mt-4 flex flex-wrap gap-2.5 text-xs">
              {result.outdated_circular_ref && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-mono font-medium text-amber-900">
                  Outdated Ref: {result.outdated_circular_ref}
                </span>
              )}
              {result.active_circular_ref && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono font-medium text-emerald-800">
                  Active Official Ref: {result.active_circular_ref}
                </span>
              )}
            </div>
          )}

          {result.citations.length > 0 && (
            <div className="mt-5 space-y-2.5 border-t border-zinc-100 pt-4">
              <h2 className="text-xs font-semibold text-zinc-500">
                Supporting Source Proof
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {result.citations.map((cit, idx) => (
                  <button
                    key={`${cit.notice_id}-${idx}`}
                    type="button"
                    onClick={() => onInspectCircular(cit.notice_id)}
                    className="group cursor-pointer rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 text-left transition hover:border-zinc-400 hover:bg-white"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold text-[#1E3A5F]">
                        {cit.circular_no} · p.{cit.page}
                      </span>
                      <ArrowUpRight
                        className="h-4 w-4 text-zinc-400 transition group-hover:text-zinc-900"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-zinc-900">
                      {cit.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">
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
      <div className="flex items-center gap-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-block rounded-full bg-emerald-700 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-white">
            VERIFIED
          </span>
          <h2 className="mt-1 text-base font-bold text-emerald-950">
            {result.headline}
          </h2>
        </div>
      </div>
    );
  }

  if (result.verdict === "OUTDATED") {
    return (
      <div className="flex items-center gap-3.5 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-block rounded-full bg-amber-700 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-white">
            OUTDATED
          </span>
          <h2 className="mt-1 text-base font-bold text-amber-950">
            {result.headline}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 p-4">
      <div className="flex items-center gap-3.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
          <ShieldX className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <span className="inline-block rounded-full bg-rose-700 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-white">
            UNVERIFIED RUMOR
          </span>
          <h2 className="mt-1 text-base font-bold text-rose-950">
            {result.headline}
          </h2>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
        Do Not Forward
      </span>
    </div>
  );
}
