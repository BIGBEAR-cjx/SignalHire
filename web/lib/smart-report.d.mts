export type SmartReportView = {
  title: string;
  brief_summary: string;
  metrics: {
    candidates: number;
    strong_evidence: number;
    ready_for_outreach: number;
    needs_scheduling: number;
  };
  source_mix: Array<{
    source_type: string;
    label: string;
    count: number;
    tooltip: string;
  }>;
  top_candidates: Array<{
    name: string;
    role: string;
    match_score: number;
    evidence_quality: string;
    evidence_summary: string;
    primary_risk: string;
    outreach_status: string;
    next_action: string;
  }>;
  referral_summary: Array<{
    candidate_name: string;
    path_type: string;
    shared_context: string;
    introducer_label: string;
    confidence: string;
    intro_snippet: string;
  }>;
  risks: string[];
  next_actions: string[];
  client_delivery_loop: {
    title: string;
    summary: string;
    weekly_progress: {
      window_label: string;
      metrics: {
        new_candidates: number;
        contacted: number;
        replied: number;
        interview_ready: number;
        confirmed: number;
      };
    };
    evidence_summary: string;
    risks: string[];
    next_actions: string[];
  };
};

export type ClientDeliveryVersionHistory = {
  title: string;
  summary: string;
  items: Array<{
    id: string;
    label: string;
    summary: string;
    status: string;
    delivered_at: string;
    candidate_count: number;
    href: string;
    is_current: boolean;
  }>;
};

export type ClientDeliverySnapshot = {
  title: string;
  summary: string;
  snapshot_id: string;
  frozen_at: string;
  window_label: string;
  metrics: {
    new_candidates: number;
    contacted: number;
    replied: number;
    interview_ready: number;
    confirmed: number;
  };
  candidate_count: number;
  evidence_summary: string;
  risks: string[];
  next_actions: string[];
};

export type ClientDeliveryWeeklyArchive = {
  title: string;
  summary: string;
  items: Array<{
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
  }>;
};

export function attachClientDeliveryLoopSnapshot(result?: unknown, snapshot?: unknown): unknown;
export function buildClientDeliverySnapshot(run?: unknown, result?: unknown, options?: { locale?: "zh" | "en" }): ClientDeliverySnapshot;
export function buildClientDeliveryVersionHistory(runs?: unknown[], options?: { currentRunId?: string; locale?: "zh" | "en"; limit?: number }): ClientDeliveryVersionHistory;
export function buildClientDeliveryWeeklyArchive(runs?: unknown[], options?: { locale?: "zh" | "en"; limit?: number }): ClientDeliveryWeeklyArchive;
export function buildSmartReportView(result?: unknown, options?: { locale?: "zh" | "en" }): SmartReportView;
