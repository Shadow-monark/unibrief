"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { AdminDesk } from "@/components/AdminDesk";
import { AskCampusQA } from "@/components/AskCampusQA";
import { CalmOrbScene } from "@/components/CalmOrbScene";
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
    <div className="relative min-h-dvh overflow-x-hidden bg-gradient-to-br from-[#DCE9F8] via-[#EEF5FB] to-[#DCEEE8]">
      {/* Calm Atmospheric Silk Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="animate-aurora-slow absolute -top-36 -left-24 h-[520px] w-[520px] rounded-full bg-sky-300/35 blur-3xl" />
        <div className="animate-aurora-reverse absolute top-1/4 -right-24 h-[560px] w-[560px] rounded-full bg-teal-200/45 blur-3xl" />
        <div className="animate-aurora-slow absolute -bottom-36 left-1/4 h-[460px] w-[460px] rounded-full bg-blue-200/35 blur-3xl" />
      </div>

      {/* Transparent 3D Glass Student ID Card */}
      <CalmOrbScene profile={profile} />

      <div className="relative z-10 flex min-h-dvh flex-col">
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

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
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
                  onInspectCircular={(id) => setInspectedNoticeId(id)}
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
      </div>

      {/* Proof & Draft Modals */}
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

      {/* Frosted Toasts */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-5 bottom-5 z-50 flex w-full max-w-sm flex-col gap-2.5"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`glass-panel pointer-events-auto flex items-start gap-3 rounded-2xl p-4 text-xs shadow-lg ${
              toast.tone === "error"
                ? "border-rose-200/90 bg-rose-50/85 text-rose-900"
                : toast.tone === "success"
                  ? "border-emerald-200/90 bg-emerald-50/85 text-emerald-900"
                  : "text-slate-900"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-rose-600"
                aria-hidden="true"
              />
            ) : toast.tone === "success" ? (
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : (
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-slate-600"
                aria-hidden="true"
              />
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
