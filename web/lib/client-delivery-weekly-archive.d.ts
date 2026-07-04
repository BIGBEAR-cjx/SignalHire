export type ClientDeliveryWeeklyArchiveRow = {
  user_id: string;
  project_id: string;
  archive_id: string;
  week_start: string;
  week_end: string;
  label: string;
  latest_report_id: string;
  latest_snapshot_id: string;
  metrics: {
    new_candidates: number;
    contacted: number;
    replied: number;
    interview_ready: number;
    confirmed: number;
  };
  risks: string[];
  next_actions: string[];
  reports: Array<{
    id: string;
    label: string;
    summary: string;
    delivered_at: string;
    href: string;
    snapshot_id: string;
    candidate_count: number;
  }>;
  latest_report_at: string;
};

export function buildClientDeliveryWeeklyArchiveRow(input?: {
  userId?: string | null;
  projectId?: string | null;
  item?: unknown;
}): ClientDeliveryWeeklyArchiveRow | null;

export function buildClientDeliveryWeeklyArchiveFromRows(rows?: unknown[], options?: {
  locale?: "zh" | "en";
  limit?: number;
}): {
  title: string;
  summary: string;
  items: Array<{
    archive_id: string;
    week_start: string;
    week_end: string;
    label: string;
    latest_report_id: string;
    latest_snapshot_id: string;
    metrics: ClientDeliveryWeeklyArchiveRow["metrics"];
    risks: string[];
    next_actions: string[];
    reports: ClientDeliveryWeeklyArchiveRow["reports"];
  }>;
};
