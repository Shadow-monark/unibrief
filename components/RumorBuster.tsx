"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  SearchCheck,
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
  "Guys confirm news: Sem 3 Mid-Sem starts 28 Nov!",
  "Kal college mein sudden holiday declare ho gaya hai!",
  "Medical grounds pe 65% attendance pe exam de sakte hain?",
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
        headers: {
          "Content-Type": "application/json",
        },
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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Rumor Buster
        </h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Fact-check any WhatsApp forward against {notices.length} official
          circulars.
        </p>
      </div>

      <section className="glass-panel rounded-3xl p-5 sm:p-7">
        {/* Whisper-clean Demo Presets */}
        <div className="flex flex-wrap justify-center gap-2">
          {DEMO_RUMORS.map((text) => (
            <button
              key={text}
              type="button"
              disabled={loading}
              onClick={() => verifyClaim(text)}
              className="glass-card cursor-pointer rounded-full px-3.5 py-1.5 text-xs font-medium text-slate-700 transition disabled:opacity-50"
            >
              &ldquo;{text}&rdquo;
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyClaim(claim);
          }}
          className="mt-5 space-y-3"
        >
          <textarea
            rows={3}
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            aria-label="Forwarded claim to verify"
            placeholder="Paste forwarded campus message here..."
            className="w-full rounded-2xl bg-white/80 p-4 text-sm text-slate-900 placeholder:text-slate-400 ring-1 ring-white transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || !claim.trim()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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

      {result && (
        <section className="glass-panel rounded-3xl p-6 space-y-4">
          <VerdictBanner result={result} />

          <p className="text-sm leading-relaxed text-slate-700">
            {result.explanation}
          </p>

          {(result.active_circular_ref || result.outdated_circular_ref) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {result.outdated_circular_ref && (
                <span className="rounded-full bg-amber-500/12 px-3 py-1 font-mono font-medium text-amber-900">
                  Outdated: {result.outdated_circular_ref}
                </span>
              )}
              {result.active_circular_ref && (
                <span className="rounded-full bg-emerald-500/12 px-3 py-1 font-mono font-medium text-emerald-800">
                  Active: {result.active_circular_ref}
                </span>
              )}
            </div>
          )}

          {result.citations.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {result.citations.map((cit, idx) => (
                <button
                  key={`${cit.notice_id}-${idx}`}
                  type="button"
                  onClick={() => onInspectCircular(cit.notice_id)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-1.5 font-mono text-xs font-semibold text-[#1E3A5F] ring-1 ring-slate-200/80 transition hover:bg-slate-900 hover:text-white"
                >
                  {cit.circular_no} · p.{cit.page}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ))}
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
      <div className="flex items-center gap-3.5 rounded-2xl bg-emerald-500/12 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <span className="text-[11px] font-bold tracking-wider text-emerald-800 uppercase">
            Verified
          </span>
          <h2 className="text-base font-semibold text-emerald-950">
            {result.headline}
          </h2>
        </div>
      </div>
    );
  }

  if (result.verdict === "OUTDATED") {
    return (
      <div className="flex items-center gap-3.5 rounded-2xl bg-amber-500/14 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-600 text-white">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <span className="text-[11px] font-bold tracking-wider text-amber-900 uppercase">
            Outdated
          </span>
          <h2 className="text-base font-semibold text-amber-950">
            {result.headline}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3.5 rounded-2xl bg-rose-500/12 p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-600 text-white">
        <ShieldX className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <span className="text-[11px] font-bold tracking-wider text-rose-800 uppercase">
          Unverified Rumor
        </span>
        <h2 className="text-base font-semibold text-rose-950">
          {result.headline}
        </h2>
      </div>
    </div>
  );
}
