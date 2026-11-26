export type NoticeStatus = "active" | "superseded";
export type AudienceType = "all" | "hosteller" | "day_scholar";
export type UrgencyLevel = "critical" | "high" | "normal";
export type BranchOption = "All" | "CSE" | "AIML" | "ECE" | "ME";
export type ResidenceFilter = "Hosteller" | "Day Scholar";

export interface PageReference {
  page: number;
  excerpt: string;
}

export interface PolicyRules {
  min_attendance?: number;
  medical_min?: number;
  clause?: string;
  submission_days?: number;
}

export interface Notice {
  id: string;
  circular_no: string;
  title: string;
  summary: string;
  extracted_text: string;
  page_references: PageReference[];
  topic_tag: string;
  effective_date: string; // YYYY-MM-DD
  status: NoticeStatus;
  superseded_by_id: string | null;
  target_branches: string[];
  target_semesters: number[];
  audience_type: AudienceType;
  policy_rules: PolicyRules | null;
  file_name: string;
  file_mime: string;
  file_data_url?: string;
  created_at: string;
}

export interface Deadline {
  id: string;
  notice_id: string;
  circular_no: string;
  title: string;
  due_date: string; // YYYY-MM-DD
  due_time: string;
  penalty_impact: string;
  urgency: UrgencyLevel;
  action_url: string | null;
  target_branches: string[];
  target_semesters: number[];
  audience_type: AudienceType;
  status: NoticeStatus;
  completed: boolean;
}

export interface AlertLog {
  id: string;
  notice_id: string;
  circular_no: string;
  channel: "webhook" | "in_app";
  message: string;
  sent_at: string;
}

export interface CampusDbState {
  notices: Notice[];
  deadlines: Deadline[];
  alert_logs: AlertLog[];
}

export interface StudentProfile {
  branch: BranchOption;
  semester: number;
  residence: ResidenceFilter;
}

export interface AskCitation {
  notice_id: string;
  circular_no: string;
  title: string;
  page: number;
  excerpt: string;
  status: NoticeStatus;
  effective_date: string;
}

export interface ConflictResolution {
  detected: boolean;
  topic_tag: string;
  superseded_circular_no: string;
  superseded_rule: string;
  active_circular_no: string;
  active_rule: string;
  note: string;
}

export interface ExtractedDeadlineSuggestion {
  title: string;
  due_date: string; // YYYY-MM-DD
  due_time: string;
  penalty_impact: string;
  circular_no: string;
}

export interface SuggestedEmail {
  subject: string;
  recipient_role: string;
  body_template: string;
  cited_circular_no: string;
  cited_clause: string | null;
}

export interface AskResponse {
  answer: string;
  found_in_official_records: boolean;
  conflict_resolution: ConflictResolution | null;
  citations: AskCitation[];
  extracted_deadlines: ExtractedDeadlineSuggestion[];
  suggested_email: SuggestedEmail | null;
  engine_used: string;
}

export type RumorVerdict = "VERIFIED" | "OUTDATED" | "UNVERIFIED_RUMOR";

export interface VerifyRumorResponse {
  verdict: RumorVerdict;
  headline: string;
  explanation: string;
  active_circular_ref: string | null;
  outdated_circular_ref: string | null;
  citations: AskCitation[];
  engine_used: string;
}

export interface PipelineLogEntry {
  step:
    | "Extracting Multimodal JSON"
    | "Checking Topic Conflicts"
    | "Auto-Superseding Old Circulars"
    | "Creating Deadlines"
    | "Dispatching Alerts"
    | "Error";
  status: "completed" | "skipped" | "failed";
  detail: string;
  timestamp: string;
}

export interface IngestFileResult {
  file_name: string;
  notice: Notice;
  superseded_notice_ids: string[];
  created_deadlines: Deadline[];
  alerts_dispatched: AlertLog[];
  logs: PipelineLogEntry[];
}

export interface IngestResponse {
  results: IngestFileResult[];
  logs: PipelineLogEntry[];
  engine_used: string;
}
