export type Category =
  | "Billing"
  | "Technical Issue"
  | "Account Access"
  | "Bug Report"
  | "Feature Request"
  | "Complaint"
  | "Security Concern"
  | "General Inquiry";

export type Priority = "High" | "Medium" | "Low";

export type Team =
  | "Billing Support"
  | "Technical Support"
  | "Engineering"
  | "Account Management"
  | "Product Team"
  | "Security Team"
  | "Customer Success"
  | "Triage";

export type Tone = "neutral" | "frustrated" | "angry" | "urgent" | "confused" | "positive";

export const CATEGORIES: Category[] = [
  "Billing",
  "Technical Issue",
  "Account Access",
  "Bug Report",
  "Feature Request",
  "Complaint",
  "Security Concern",
  "General Inquiry",
];

export const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

export const TEAMS: Team[] = [
  "Billing Support",
  "Technical Support",
  "Engineering",
  "Account Management",
  "Product Team",
  "Security Team",
  "Customer Success",
  "Triage",
];

export interface BaselineResult {
  category: Category;
  priority: Priority;
  team: Team;
  reasoning: string;
}

export interface TicketResult {
  id: string;
  message: string;
  category: Category;
  priority: Priority;
  team: Team;
  tone: Tone;
  confidence: number;
  is_ambiguous: boolean;
  escalated: boolean;
  reasoning: string;
  model_used: string;
  mode: "live" | "mock" | "repaired" | "fallback";
  latency_ms: number;
  manual_time_seconds: number | null;
  created_at: string;
  baseline?: BaselineResult | null;
  reviewed?: boolean;
  corrected_category?: Category | null;
  corrected_priority?: Priority | null;
  corrected_team?: Team | null;
  feedback_note?: string | null;
}

export interface HealthInfo {
  status: string;
  mode: "live" | "mock";
  model: string;
  forced_mock: boolean;
  reason: string | null;
  ticket_count: number;
}

export interface AnalyticsData {
  total_tickets: number;
  avg_ai_latency_ms: number;
  avg_manual_seconds: number;
  measured_manual_count: number;
  total_ai_seconds: number;
  total_manual_seconds: number;
  total_time_saved_seconds: number;
  time_saved_pct: number;
  category_breakdown: Record<string, number>;
  priority_breakdown: Record<string, number>;
  team_breakdown: Record<string, number>;
  tone_breakdown: Record<string, number>;
  mode_breakdown: Record<string, number>;
  ambiguous_count: number;
  escalated_count: number;
  feedback_count: number;
  agreement_rate: number | null;
}

export interface SampleTicket {
  text: string;
  tag: string;
}

export interface RepairExample {
  input: string;
  recovered: Record<string, unknown> | null;
  success: boolean;
}
