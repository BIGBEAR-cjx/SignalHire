export type ProfileLeadLayerView = {
  provider: "openjobs_mira" | "people_api";
  enabled: boolean;
  lead_count: number;
  verified_candidate_count: number;
  needs_evidence_count: number;
  copy: {
    title: string;
    explanation: string;
    next_step: string;
  };
};

export function buildProfileLeadLayerView(input?: {
  leadPreview?: unknown;
  candidateGraph?: unknown;
  env?: Record<string, unknown>;
  locale?: "zh" | "en" | string;
}): ProfileLeadLayerView;
