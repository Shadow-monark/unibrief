"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  CalendarClock,
  ChevronDown,
  KeyRound,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import type { BranchOption, ResidenceFilter, StudentProfile } from "@/types/campus";

export type StudentTab = "radar" | "ask" | "rumor" | "simulator";
export type WorkspaceRole = "student" | "admin";

interface TopNavProps {
  profile: StudentProfile;
  onProfileChange: (next: StudentProfile) => void;
  role: WorkspaceRole;
  onRoleChange: (role: WorkspaceRole) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  verifiedNoticeCount: number;
  pendingDeadlineCount: number;
  engineStatus: "groq" | "unconfigured";
  hasSessionKey: boolean;
  onOpenKeyModal: () => void;
}

const BRANCHES: BranchOption[] = ["All", "CSE", "AIML", "ECE", "ME"];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const RESIDENCES: ResidenceFilter[] = ["Hosteller", "Day Scholar"];

export function TopNav({
  profile,
  onProfileChange,
  role,
  onRoleChange,
  activeTab,
  onTabChange,
  verifiedNoticeCount,
  pendingDeadlineCount,
  engineStatus,
  hasSessionKey,
  onOpenKeyModal,
}: TopNavProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setProfileOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
      <div className="glass-panel mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 rounded-full px-4 py-2.5 sm:px-5">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">
            UniBrief
          </span>
          <span
            title={`${verifiedNoticeCount} verified official circulars`}
            className="hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 sm:inline-flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {verifiedNoticeCount}
          </span>
        </div>

        {/* Center Calm Navigation */}
        {role === "student" ? (
          <nav
            aria-label="Student OS modules"
            className="order-3 flex w-full items-center justify-center gap-1 overflow-x-auto pt-1 md:order-2 md:w-auto md:pt-0"
          >
            <NavTabButton
              active={activeTab === "radar"}
              onClick={() => onTabChange("radar")}
              icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Radar"
              badge={
                pendingDeadlineCount > 0 ? String(pendingDeadlineCount) : undefined
              }
            />
            <NavTabButton
              active={activeTab === "ask"}
              onClick={() => onTabChange("ask")}
              icon={
                <MessageSquareText className="h-3.5 w-3.5" aria-hidden="true" />
              }
              label="Ask AI"
            />
            <NavTabButton
              active={activeTab === "rumor"}
              onClick={() => onTabChange("rumor")}
              icon={<ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Rumor Check"
            />
            <NavTabButton
              active={activeTab === "simulator"}
              onClick={() => onTabChange("simulator")}
              icon={<Calculator className="h-3.5 w-3.5" aria-hidden="true" />}
              label="Simulator"
            />
          </nav>
        ) : (
          <div className="order-3 text-xs font-semibold text-slate-600 md:order-2">
            Admin / CR Ingestion Workspace
          </div>
        )}

        {/* Right Controls: Compact Profile Popover + Admin Switch */}
        <div className="order-2 flex items-center gap-2 md:order-3">
          {engineStatus === "unconfigured" && (
            <button
              type="button"
              onClick={onOpenKeyModal}
              title="Connect Groq API Key for this session"
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                hasSessionKey
                  ? "bg-emerald-500/12 text-emerald-800 hover:bg-emerald-500/20"
                  : "bg-amber-100/90 text-amber-900 hover:bg-amber-200"
              }`}
            >
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              <span>{hasSessionKey ? "Key Ready" : "Connect Key"}</span>
            </button>
          )}

          {/* Profile Popover Trigger */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              aria-expanded={profileOpen}
              aria-haspopup="dialog"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs transition hover:bg-white"
            >
              <SlidersHorizontal
                className="h-3.5 w-3.5 text-slate-500"
                aria-hidden="true"
              />
              <span className="tabular-nums">
                {profile.branch} · S{profile.semester}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
                  profileOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>

            {profileOpen && (
              <div
                role="dialog"
                aria-label="Student profile filters"
                className="glass-panel absolute right-0 mt-2.5 w-72 rounded-3xl p-4 shadow-xl"
              >
                <div className="space-y-3.5">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Branch
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {BRANCHES.map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() =>
                            onProfileChange({ ...profile, branch: b })
                          }
                          className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition ${
                            profile.branch === b
                              ? "bg-slate-900 text-white"
                              : "bg-white/70 text-slate-700 hover:bg-white"
                          }`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Semester
                    </span>
                    <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                      {SEMESTERS.map((sem) => (
                        <button
                          key={sem}
                          type="button"
                          onClick={() =>
                            onProfileChange({ ...profile, semester: sem })
                          }
                          className={`cursor-pointer rounded-full py-1 text-xs font-medium tabular-nums transition ${
                            profile.semester === sem
                              ? "bg-slate-900 text-white"
                              : "bg-white/70 text-slate-700 hover:bg-white"
                          }`}
                        >
                          Sem {sem}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Residence
                    </span>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {RESIDENCES.map((res) => (
                        <button
                          key={res}
                          type="button"
                          onClick={() =>
                            onProfileChange({ ...profile, residence: res })
                          }
                          className={`cursor-pointer rounded-full py-1.5 text-xs font-medium transition ${
                            profile.residence === res
                              ? "bg-slate-900 text-white"
                              : "bg-white/70 text-slate-700 hover:bg-white"
                          }`}
                        >
                          {res}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Role Toggle */}
          <button
            type="button"
            onClick={() =>
              onRoleChange(role === "student" ? "admin" : "student")
            }
            aria-pressed={role === "admin"}
            className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              role === "admin"
                ? "bg-slate-900 text-white shadow-xs"
                : "border border-white/80 bg-white/70 text-slate-700 hover:bg-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{role === "admin" ? "Exit Admin" : "Admin"}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function NavTabButton({
  active,
  onClick,
  icon,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all ${
        active
          ? "bg-slate-900 text-white shadow-xs"
          : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span
          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold tabular-nums ${
            active ? "bg-white/20 text-white" : "bg-slate-900/10 text-slate-700"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
