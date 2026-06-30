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
};

export function buildSmartReportView(result?: unknown, options?: { locale?: "zh" | "en" }): SmartReportView;
