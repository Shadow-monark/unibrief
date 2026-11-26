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
          completed ? "Marked deadline as done." : "Reopened deadline.",
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
    <div className="min-h-dvh bg-[#F7F8FA]">
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

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
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

      {/* Accessible Live Toasts */}
      <div
        aria-live="polite"
        className="fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2 pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex items-start gap-2.5 rounded-sm border p-3.5 text-xs shadow-sm ${
              toast.tone === "error"
                ? "border-[#FCA5A5] bg-[#FEF2F2] text-[#991B1B]"
                : toast.tone === "success"
                  ? "border-[#86EFAC] bg-[#F0FDF4] text-[#166534]"
                  : "border-[#CBD5E1] bg-white text-[#0F172A]"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : toast.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <p className="flex-1 leading-relaxed font-medium">{toast.message}</p>
            <button
              type="button"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
              aria-label="Dismiss notification"
              className="cursor-pointer opacity-70 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
