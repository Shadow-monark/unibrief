"use client";

import { useEffect, useState } from "react";
import { Check, KeyRound, Trash2, X } from "lucide-react";

interface ApiKeyModalProps {
  open: boolean;
  currentKey: string;
  onSave: (nextKey: string) => void;
  onClose: () => void;
}

export function ApiKeyModal({
  open,
  currentKey,
  onSave,
  onClose,
}: ApiKeyModalProps) {
  const [draft, setDraft] = useState(currentKey);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-md rounded-3xl bg-white/90 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="api-key-modal-title"
                className="text-base font-bold text-slate-900"
              >
                Connect Groq API Key
              </h2>
              <p className="text-xs text-slate-500">
                Server env var missing — activate AI instantly
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close API key modal"
            className="cursor-pointer rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-800"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            onClose();
          }}
          className="mt-5 space-y-4"
        >
          <label className="block text-xs font-semibold text-slate-700">
            Groq API Key (<span className="font-mono">gsk_...</span>)
            <input
              type="password"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="gsk_..."
              autoFocus
              className="mt-1.5 w-full rounded-2xl bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 ring-1 ring-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
            />
          </label>

          <p className="rounded-2xl bg-slate-50/90 p-3 text-[11px] leading-relaxed text-slate-600">
            Stored only in your browser&apos;s <span className="font-mono">sessionStorage</span> for this tab. For permanent Vercel hosting, add{" "}
            <span className="font-mono font-semibold text-slate-800">
              GROQ_API_KEY
            </span>{" "}
            in Vercel Project Settings → Environment Variables and redeploy.
          </p>

          <div className="flex items-center justify-between gap-2 pt-1">
            {currentKey ? (
              <button
                type="button"
                onClick={() => {
                  setDraft("");
                  onSave("");
                  onClose();
                }}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                Clear Key
              </button>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={!draft.trim()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Save for Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
