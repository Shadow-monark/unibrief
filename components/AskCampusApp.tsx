"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { AdminDesk } from "@/components/AdminDesk";
import { AskCampusQA } from "@/components/AskCampusQA";
import { CircularPreviewModal } from "@/components/CircularPreviewModal";
import { DeadlineRadar } from "@/components/DeadlineRadar";
import { DraftMailModal } from "@/components/DraftMailModal";
import { RuleSimulator } from "@/components/RuleSimulator";
import { RumorBuster } from "@/components/RumorBuster";
import {
  TopNav,
  type StudentTab,
  type WorkspaceRole,
} from "@/components/TopNav";
import { filterDeadlinesForProfile } from "@/lib/profile";
import type {
  CampusDbState,
  Deadline,
  StudentProfile,
  SuggestedEmail,
} from "@/types/campus";

interface ToastItem {
  id: string;
  message: string;
  tone: "success" | "error" | "info";
}

interface AskCampusAppProps {
  initialState: CampusDbState;
  initialEngineStatus: "groq" | "unconfigured";
}

export function AskCampusApp({
  initialState,
  initialEngineStatus,
}: AskCampusAppProps) {
  const [state, setState] = useState<CampusDbState>(initialState);
  const [engineStatus, setEngineStatus] = useState(initialEngineStatus);
  const [role, setRole] = useState<WorkspaceRole>("student");
  const [activeTab, setActiveTab] = useState<StudentTab>("radar");
  const [profile, setProfile] = useState<StudentProfile>({
    branch: "CSE",
    semester: 3,
    residence: "Hosteller",
  });

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [inspectedNoticeId, setInspectedNoticeId] = useState<string | null>(
    null
  );
  const [draftEmail, setDraftEmail] = useState<SuggestedEmail | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (message: string, tone: "success" | "error" | "info" = "info") => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    []
  );

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as CampusDbState & {
        engine_status?: "groq" | "unconfigured";
      };
      setState({
        notices: data.notices,
        deadlines: data.deadlines,
        alert_logs: data.alert_logs,
      });
      if (data.engine_status) {
        setEngineStatus(data.engine_status);
      }
    } catch {
      pushToast("Could not refresh campus state from server.", "error");
    }
  }, [pushToast]);

  const handleToggleDeadline = useCallback(
    async (id: string, completed: boolean) => {
      setTogglingId(id);
      setState((prev) => ({
        ...prev,
        deadlines: prev.deadlines.map((d) =>
          d.id === id ? { ...d, completed } : d
        ),
      }));

      try {
        const res = await fetch(`/api/deadlines/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed }),
        });

        const payload = (await res.json()) as {
          deadline?: Deadline;
          error?: string;
        };

        if (!res.ok || !payload.deadline) {
          throw new Error(payload.error || "Failed to update deadline.");
        }

        setState((prev) => ({
          ...prev,
          deadlines: prev.deadlines.map((d) =>
            d.id === id ? payload.deadline! : d
          ),
        }));
        pushToast(
          completed ? "Marked deadline as completed." : "Deadline reopened.",
          "success"
        );
      } catch (err) {
        setState((prev) => ({
          ...prev,
          deadlines: prev.deadlines.map((d) =>
            d.id === id ? { ...d, completed: !completed } : d
          ),
        }));
        pushToast(
          err instanceof Error ? err.message : "Could not update deadline.",
          "error"
        );
      } finally {
        setTogglingId(null);
      }
    },
    [pushToast]
  );

  const verifiedNoticeCount = useMemo(
    () => state.notices.filter((n) => n.status === "active").length,
    [state.notices]
  );

  const pendingDeadlineCount = useMemo(
    () =>
      filterDeadlinesForProfile(state.deadlines, profile, false).filter(
        (d) => !d.completed
      ).length,
    [state.deadlines, profile]
  );

  const inspectedNotice = useMemo(
    () => state.notices.find((n) => n.id === inspectedNoticeId) ?? null,
    [state.notices, inspectedNoticeId]
  );

  return (
    <div className="min-h-dvh bg-[#FAFAFA] bg-[radial-gradient(ellipse_85%_35%_at_50%_-8%,rgba(30,58,95,0.06),transparent)]">
      <TopNav
        profile={profile}
        onProfileChange={setProfile}
        role={role}
        onRoleChange={setRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        verifiedNoticeCount={verifiedNoticeCount}
        pendingDeadlineCount={pendingDeadlineCount}
        engineStatus={engineStatus}
      />

      <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8">
        {role === "admin" ? (
          <AdminDesk
            notices={state.notices}
            onIngestComplete={refreshState}
            onInspectCircular={(id) => setInspectedNoticeId(id)}
            onToast={pushToast}
          />
        ) : (
          <>
            {activeTab === "radar" && (
              <DeadlineRadar
                deadlines={state.deadlines}
                notices={state.notices}
                alertLogs={state.alert_logs}
                profile={profile}
                togglingId={togglingId}
                onToggleDeadline={handleToggleDeadline}
                onInspectCircular={(id) => setInspectedNoticeId(id)}
              />
            )}

            {activeTab === "ask" && (
              <AskCampusQA
                notices={state.notices}
                profile={profile}
                onDraftEmail={(email) => setDraftEmail(email)}
                onToast={pushToast}
              />
            )}

            {activeTab === "rumor" && (
              <RumorBuster
                notices={state.notices}
                onInspectCircular={(id) => setInspectedNoticeId(id)}
                onToast={pushToast}
              />
            )}

            {activeTab === "simulator" && (
              <RuleSimulator
                notices={state.notices}
                profile={profile}
                onInspectCircular={(id) => setInspectedNoticeId(id)}
                onDraftEmail={(email) => setDraftEmail(email)}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <CircularPreviewModal
        notice={inspectedNotice}
        allNotices={state.notices}
        onClose={() => setInspectedNoticeId(null)}
        onSelectNotice={(id) => setInspectedNoticeId(id)}
      />

      <DraftMailModal
        draft={draftEmail}
        profile={profile}
        onClose={() => setDraftEmail(null)}
        onToast={pushToast}
      />

      {/* Sleek Floating Toasts */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-full max-w-sm flex-col gap-2.5"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 text-xs shadow-[0_8px_24px_rgba(15,23,42,0.1)] backdrop-blur-md ${
              toast.tone === "error"
                ? "border-red-200 bg-red-50/95 text-red-900"
                : toast.tone === "success"
                  ? "border-emerald-200 bg-emerald-50/95 text-emerald-900"
                  : "border-zinc-200 bg-white/95 text-zinc-900"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            ) : toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" aria-hidden="true" />
            )}
            <p className="flex-1 font-medium leading-relaxed">{toast.message}</p>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              aria-label="Dismiss notification"
              className="cursor-pointer rounded-full p-0.5 opacity-60 transition hover:bg-black/5 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
