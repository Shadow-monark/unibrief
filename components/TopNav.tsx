"use client";

import {
  BookOpenCheck,
  Calculator,
  CalendarClock,
  CheckCircle2,
  MessageSquareQuote,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
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
    <header className="sticky top-0 z-30 border-b border-[#CBD5E1] bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Top Row: Brand + Profile Filters + Role Switcher */}
        <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Brand */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-[#1E3A5F] bg-[#1E3A5F] text-white">
                <BookOpenCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-serif text-xl font-semibold tracking-tight text-[#0F172A]">
                    AskCampus
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-[#86EFAC] bg-[#F0FDF4] px-2 py-0.5 font-mono text-xs font-medium text-[#166534] tabular-nums">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    {verifiedNoticeCount} Verified
                  </span>
                </div>
                <p className="text-xs text-[#475569]">
                  Campus Knowledge, Deadline Radar &amp; Action OS
                </p>
              </div>
            </div>

            {/* Mobile role switcher */}
            <div className="flex lg:hidden">
              <RoleSegmentedToggle role={role} onRoleChange={onRoleChange} />
            </div>
          </div>

          {/* Student Profile Filter Bar + Desktop Role Switcher */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div
              className="flex flex-wrap items-center gap-2 rounded-sm border border-[#CBD5E1] bg-[#F7F8FA] px-2.5 py-1.5"
              role="group"
              aria-label="Student profile context filters"
            >
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#334155]">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[#1E3A5F]" aria-hidden="true" />
                Profile
              </span>

              <label className="flex items-center gap-1.5 text-xs text-[#475569]">
                <span className="sr-only">Branch</span>
                <select
                  aria-label="Branch"
                  value={profile.branch}
                  onChange={(e) =>
                    onProfileChange({
                      ...profile,
                      branch: e.target.value as BranchOption,
                    })
                  }
                  className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-white px-2 py-1 text-xs font-medium text-[#0F172A]"
                >
                  {BRANCHES.map((b) => (
                    <option key={b} value={b}>
                      {b === "All" ? "Branch: All" : b}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-[#475569]">
                <span className="sr-only">Semester</span>
                <select
                  aria-label="Semester"
                  value={profile.semester}
                  onChange={(e) =>
                    onProfileChange({
                      ...profile,
                      semester: Number(e.target.value),
                    })
                  }
                  className="cursor-pointer rounded-sm border border-[#CBD5E1] bg-white px-2 py-1 font-mono text-xs font-medium text-[#0F172A] tabular-nums"
                >
                  {SEMESTERS.map((sem) => (
                    <option key={sem} value={sem}>
                      Sem {sem}
                    </option>
                  ))}
                </select>
              </label>

              <div
                className="inline-flex rounded-sm border border-[#CBD5E1] bg-white p-0.5"
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
                      className={`cursor-pointer rounded-xs px-2 py-0.5 text-xs font-medium transition-colors duration-150 ${
                        active
                          ? "bg-[#1E3A5F] text-white"
                          : "text-[#475569] hover:text-[#0F172A]"
                      }`}
                    >
                      {res}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hidden lg:flex items-center gap-2">
              {engineStatus === "unconfigured" && (
                <span
                  title="Configure GROQ_API_KEY in .env.local for live AI queries"
                  className="inline-flex items-center gap-1 rounded-sm border border-[#FCD34D] bg-[#FFFBEB] px-2 py-1 font-mono text-[11px] font-medium text-[#92400E]"
                >
                  API Key Missing
                </span>
              )}
              <RoleSegmentedToggle role={role} onRoleChange={onRoleChange} />
            </div>
          </div>
        </div>

        {/* Module Navigation Tabs (Student OS) */}
        {role === "student" && (
          <nav
            aria-label="Student OS modules"
            className="-mb-px flex items-center gap-1 overflow-x-auto border-t border-[#E2E8F0] pt-1"
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
                <MessageSquareQuote className="h-4 w-4" aria-hidden="true" />
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
      className="inline-flex rounded-sm border border-[#CBD5E1] bg-[#EFF2F6] p-0.5"
      role="group"
      aria-label="Workspace role switcher"
    >
      <button
        type="button"
        onClick={() => onRoleChange("student")}
        aria-pressed={role === "student"}
        className={`cursor-pointer rounded-xs px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
          role === "student"
            ? "bg-white text-[#0F172A] shadow-2xs ring-1 ring-[#CBD5E1]"
            : "text-[#475569] hover:text-[#0F172A]"
        }`}
      >
        Student OS
      </button>
      <button
        type="button"
        onClick={() => onRoleChange("admin")}
        aria-pressed={role === "admin"}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xs px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
          role === "admin"
            ? "bg-[#1E3A5F] text-white"
            : "text-[#475569] hover:text-[#0F172A]"
        }`}
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Admin / CR Desk
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
      className={`inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ${
        active
          ? "border-[#1E3A5F] text-[#1E3A5F]"
          : "border-transparent text-[#475569] hover:border-[#CBD5E1] hover:text-[#0F172A]"
      }`}
    >
      {icon}
      <span>{label}</span>
      {badge && (
        <span
          className={`rounded-sm px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
            active
              ? "bg-[#1E3A5F] text-white"
              : "bg-[#EFF2F6] text-[#334155]"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
