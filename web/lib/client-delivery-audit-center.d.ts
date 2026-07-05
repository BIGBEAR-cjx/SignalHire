export type ClientDeliveryAuditCenterFilters = {
  project: string;
  range: "7d" | "30d" | "90d" | "all" | string;
  type: "all" | "report_view" | "feedback" | string;
};

export type ClientDeliveryAuditCenterView = {
  locale: "zh" | "en";
  filters: ClientDeliveryAuditCenterFilters;
  projects: Array<{ id: string; name: string }>;
  summary: {
    report_views: number;
    feedback: number;
    weekly_archives: number;
    latest_activity: string;
  };
  events: Array<{
    project_id: string;
    project_name: string;
    event_type: "report_view" | "feedback" | string;
    action_type: string;
    display_type: "report_view" | "feedback" | "portal_project_view" | string;
    actor: string;
    sentiment: string;
    note: string;
    report_href: string;
    event_at: string;
  }>;
  weekly_archives: Array<{
    project_id: string;
    project_name: string;
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
  }>;
};

export function buildClientDeliveryAuditCenterView(input?: {
  projects?: unknown[];
  events?: unknown[];
  weeklyArchives?: unknown[];
  filters?: Partial<ClientDeliveryAuditCenterFilters>;
  now?: string;
  locale?: "zh" | "en" | string;
}): ClientDeliveryAuditCenterView;

export function buildClientDeliveryAuditCenterCsv(view?: Partial<ClientDeliveryAuditCenterView>): string;
