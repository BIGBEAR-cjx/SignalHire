export type LeadPreviewItem = {
  id: string;
  label: "unverified lead" | "profile lead";
  candidate_name: string;
  headline: string;
  company: string;
  source_type: string;
  source_url: string;
  possible_match_reason: string;
  missing_evidence: string[];
  next_verification_step: string;
  confidence: "high" | "medium" | "low" | string;
  feedback_state: "untouched" | "relevant" | "not_relevant";
  can_outreach: false;
};

export type LeadPreviewSummary = {
  item_count: number;
  profile_lead_count: number;
  evidence_source_count: number;
  source_type_counts: Array<{ source_type: string; count: number }>;
  can_outreach_count: number;
  blocked_outreach_reason: string;
};

export type LeadPreviewConstraint = {
  lead_id: string;
  feedback: "not_relevant";
  reason: string;
  source_type: string;
  source_url: string;
  candidate_name: string;
  next_search_instruction: string;
};

export type LeadPreviewView = {
  status: "waiting_for_leads" | "preview_available" | "verified_results_available";
  items: LeadPreviewItem[];
  summary: LeadPreviewSummary;
  feedback_constraints: LeadPreviewConstraint[];
};

export function buildLeadPreviewView(input?: { run?: unknown; openEvidenceLeads?: unknown[] }): LeadPreviewView;
