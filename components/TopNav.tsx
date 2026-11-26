"use client";

import {
  Calculator,
  CalendarClock,
  GraduationCap,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
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
}: TopNavProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/85 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top Row: Brand + Profile Pill + Role Switcher */}
        <div className="flex flex-col gap-3 py-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0F172A] text-white shadow-xs">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-lg font-bold tracking-tight text-zinc-900">
                    AskCampus
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-0.5 text-xs font-medium text-emerald-700 tabular-nums">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    {verifiedNoticeCount} verified
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Campus Knowledge &amp; Deadline OS
                </p>
              </div>
            </div>

            <div className="flex lg:hidden">
              <RoleSegmentedToggle role={role} onRoleChange={onRoleChange} />
            </div>
          </div>

          {/* Floating Context Filter Pill + Role Toggle */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className="flex flex-wrap items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50/90 p-1 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
              role="group"
              aria-label="Student profile context filters"
            >
              <select
                aria-label="Branch"
                value={profile.branch}
                onChange={(e) =>
                  onProfileChange({
                    ...profile,
                    branch: e.target.value as BranchOption,
                  })
                }
                className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200/80 transition hover:ring-zinc-300"
              >
                {BRANCHES.map((b) => (
                  <option key={b} value={b}>
                    {b === "All" ? "All Branches" : b}
                  </option>
                ))}
              </select>

              <select
                aria-label="Semester"
                value={profile.semester}
                onChange={(e) =>
                  onProfileChange({
                    ...profile,
                    semester: Number(e.target.value),
                  })
                }
                className="cursor-pointer rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-800 ring-1 ring-zinc-200/80 transition hover:ring-zinc-300 tabular-nums"
              >
                {SEMESTERS.map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
              </select>

              <div
                className="inline-flex rounded-full bg-zinc-200/60 p-0.5"
                role="group"
                aria-label="Residence filter"
              >
                {RESIDENCES.map((res) => {
                  const active = profile.residence === res;
                  return (
                    <button
                      key={res}
                      type="button"
                      onClick={() =>
                        onProfileChange({ ...profile, residence: res })
                      }
                      aria-pressed={active}
                      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-all duration-150 ${
                        active
                          ? "bg-white text-zinc-900 shadow-xs"
                          : "text-zinc-600 hover:text-zinc-900"
                      }`}
                    >
                      {res}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2.5">
              {engineStatus === "unconfigured" && (
                <span
                  title="Configure GROQ_API_KEY in .env.local for live AI queries"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
                >
                  API Key Missing
                </span>
              )}
              <RoleSegmentedToggle role={role} onRoleChange={onRoleChange} />
            </div>
          </div>
        </div>

        {/* Sleek Pill Navigation Bar (Student OS) */}
        {role === "student" && (
          <nav
            aria-label="Student OS modules"
            className="flex items-center gap-1.5 overflow-x-auto pb-3 pt-1"
          >
            <NavTabButton
              active={activeTab === "radar"}
              onClick={() => onTabChange("radar")}
              icon={<CalendarClock className="h-4 w-4" aria-hidden="true" />}
              label="Deadline Radar"
              badge={
                pendingDeadlineCount > 0 ? String(pendingDeadlineCount) : undefined
              }
            />
            <NavTabButton
              active={activeTab === "ask"}
              onClick={() => onTabChange("ask")}
              icon={
                <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              }
              label="AskCampus Q&A"
            />
            <NavTabButton
              active={activeTab === "rumor"}
              onClick={() => onTabChange("rumor")}
              icon={<ShieldAlert className="h-4 w-4" aria-hidden="true" />}
              label="Rumor Buster"
            />
            <NavTabButton
              active={activeTab === "simulator"}
              onClick={() => onTabChange("simulator")}
              icon={<Calculator className="h-4 w-4" aria-hidden="true" />}
              label="Rule Simulator"
            />
          </nav>
        )}
      </div>
    </header>
  );
}

function RoleSegmentedToggle({
  role,
  onRoleChange,
}: {
  role: WorkspaceRole;
  onRoleChange: (role: WorkspaceRole) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-zinc-200 bg-zinc-100/90 p-1"
      role="group"
      aria-label="Workspace role switcher"
    >
      <button
        type="button"
        onClick={() => onRoleChange("student")}
        aria-pressed={role === "student"}
        className={`cursor-pointer rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-150 ${
          role === "student"
            ? "bg-white text-zinc-900 shadow-xs"
            : "text-zinc-600 hover:text-zinc-900"
        }`}
      >
        Student OS
      </button>
      <button
        type="button"
        onClick={() => onRoleChange("admin")}
        aria-pressed={role === "admin"}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold transition-all duration-150 ${
          role === "admin"
            ? "bg-[#0F172A] text-white shadow-xs"
            : "text-zinc-600 hover:text-zinc-900"
        }`}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Admin Desk
      </button>
    </div>
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
      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-all duration-150 ${
        active
          ? "bg-[#0F172A] text-white shadow-xs"
          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
            active
              ? "bg-white/20 text-white"
              : "bg-zinc-200/80 text-zinc-700"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
