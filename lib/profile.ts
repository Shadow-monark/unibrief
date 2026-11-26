import type {
  AudienceType,
  Deadline,
  Notice,
  PolicyRules,
  StudentProfile,
} from "@/types/campus";

export function normalizeAudienceFromResidence(
  residence: StudentProfile["residence"]
): AudienceType {
  return residence === "Hosteller" ? "hosteller" : "day_scholar";
}

export function matchesBranch(
  targetBranches: string[],
  studentBranch: StudentProfile["branch"]
): boolean {
  if (studentBranch === "All") return true;
  const normalized = targetBranches.map((b) => b.trim().toUpperCase());
  if (normalized.length === 0 || normalized.includes("ALL")) return true;
  return normalized.includes(studentBranch.toUpperCase());
}

export function matchesSemester(
  targetSemesters: number[],
  studentSemester: number
): boolean {
  if (targetSemesters.length === 0) return true;
  return targetSemesters.includes(studentSemester);
}

export function matchesResidence(
  audienceType: AudienceType,
  studentResidence: StudentProfile["residence"]
): boolean {
  if (audienceType === "all") return true;
  return audienceType === normalizeAudienceFromResidence(studentResidence);
}

export function matchesStudentProfile(
  item: {
    target_branches: string[];
    target_semesters: number[];
    audience_type: AudienceType;
  },
  profile: StudentProfile
): boolean {
  return (
    matchesBranch(item.target_branches, profile.branch) &&
    matchesSemester(item.target_semesters, profile.semester) &&
    matchesResidence(item.audience_type, profile.residence)
  );
}

export function filterDeadlinesForProfile(
  deadlines: Deadline[],
  profile: StudentProfile,
  includeSuperseded = false
): Deadline[] {
  return deadlines
    .filter((d) => (includeSuperseded ? true : d.status === "active"))
    .filter((d) => matchesStudentProfile(d, profile))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function filterNoticesForProfile(
  notices: Notice[],
  profile: StudentProfile
): Notice[] {
  const activeMatching = notices.filter(
    (n) => n.status === "active" && matchesStudentProfile(n, profile)
  );
  const activeTopics = new Set(activeMatching.map((n) => n.topic_tag));
  const supersededMatching = notices.filter(
    (n) =>
      n.status === "superseded" &&
      (matchesStudentProfile(n, profile) || activeTopics.has(n.topic_tag))
  );

  return [...activeMatching, ...supersededMatching].sort((a, b) =>
    b.effective_date.localeCompare(a.effective_date)
  );
}

export function getActiveAttendancePolicy(notices: Notice[]): {
  notice: Notice | null;
  rules: Required<PolicyRules>;
} {
  const attendanceNotice =
    notices.find(
      (n) =>
        n.status === "active" &&
        n.policy_rules !== null &&
        typeof n.policy_rules.min_attendance === "number"
    ) ??
    notices.find((n) => n.status === "active" && n.topic_tag === "medical_leave") ??
    null;

  const raw = attendanceNotice?.policy_rules ?? null;
  return {
    notice: attendanceNotice,
    rules: {
      min_attendance: raw?.min_attendance ?? 75,
      medical_min: raw?.medical_min ?? 65,
      clause: raw?.clause ?? "4.2",
      submission_days: raw?.submission_days ?? 5,
    },
  };
}

export function getDeadlineCountdown(
  dueDateStr: string,
  referenceDateStr?: string
): {
  label: string;
  daysDiff: number;
  tone: "overdue" | "soon" | "upcoming";
} {
  const todayStr =
    referenceDateStr ?? new Date().toISOString().slice(0, 10);
  const due = new Date(`${dueDateStr}T00:00:00Z`).getTime();
  const ref = new Date(`${todayStr}T00:00:00Z`).getTime();
  const daysDiff = Math.round((due - ref) / (1000 * 60 * 60 * 24));

  if (Number.isNaN(daysDiff)) {
    return { label: dueDateStr, daysDiff: 0, tone: "upcoming" };
  }
  if (daysDiff < 0) {
    return {
      label: `Overdue (${Math.abs(daysDiff)}d)`,
      daysDiff,
      tone: "overdue",
    };
  }
  if (daysDiff === 0) {
    return { label: "Due Today", daysDiff: 0, tone: "overdue" };
  }
  if (daysDiff === 1) {
    return { label: "Due Tomorrow", daysDiff: 1, tone: "soon" };
  }
  if (daysDiff <= 4) {
    return { label: `In ${daysDiff} days`, daysDiff, tone: "soon" };
  }
  return { label: `In ${daysDiff} days`, daysDiff, tone: "upcoming" };
}
