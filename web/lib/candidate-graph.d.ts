export type SourceLead = {
  source_type: "internal_resume" | "people_api" | "linkedin_seed" | "public_web" | "manual_upload";
  provider: string;
  source_url: string;
  captured_at: string;
  confidence: "high" | "medium" | "low";
  extracted_fields: Record<string, unknown>;
};

export type CandidateGraphItem = {
  candidate_id: string;
  canonical_name: string;
  current_title: string;
  current_company: string;
  locations: string[];
  source_nodes: SourceLead[];
  merge_keys: string[];
  evidence_summary: {
    quality: "high" | "medium" | "low";
    claim_count: number;
    verified_claim_count: number;
    unverified_claims: string[];
    contradicted_claims: string[];
  };
  contact_profile: unknown;
  role_fit: { score: number; must_have_hits: string[]; gaps: string[]; risks: string[] };
  readiness: "sourced" | "needs_verification" | "ready_for_outreach";
  raw_candidate: unknown;
};

export type CandidateGraph = {
  summary: {
    candidate_count: number;
    ready_for_outreach_count: number;
    needs_verification_count: number;
    interview_ready_count: number;
    source_count: number;
    contactable_count: number;
    contact_coverage_percent: number;
  };
  source_mix: Array<{ source_type: string; count: number }>;
  candidates: CandidateGraphItem[];
};

export function normalizeSourceLead(value?: unknown): SourceLead;
export function buildCandidateMergeKeys(candidate?: unknown): string[];
export function buildCandidateGraph(input?: { candidates?: unknown[]; sourceLeads?: unknown[] }): CandidateGraph;
