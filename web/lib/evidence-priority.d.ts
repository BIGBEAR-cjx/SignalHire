import type { EvidenceQuality } from "./talent-profile.mjs";

export type EvidencePriority = "ready_to_review" | "needs_backfill" | "risk_review";

export type EvidencePrioritySummary = {
  ready_to_review: number;
  needs_backfill: number;
  risk_review: number;
};

export type EvidencePriorityItem = {
  candidate_index: number;
  name: string;
  role: string;
  match_score: number;
  evidence_quality: EvidenceQuality | string;
  independent_sources: number;
  verified_count: number;
  unverified_count: number;
  contradicted_count: number;
  risk_count: number;
  priority: EvidencePriority;
  priority_label: string;
  priority_reason: string;
  recommended_action: string;
};

export type EvidencePriorityView = {
  summary: EvidencePrioritySummary;
  items: EvidencePriorityItem[];
  empty: boolean;
};

export function buildEvidencePriorityView(input?: {
  result?: unknown;
  candidates?: unknown[];
  locale?: string;
}): EvidencePriorityView;

export function buildEvidencePriorityItem(input?: {
  candidate?: unknown;
  result?: unknown;
  locale?: string;
  candidateIndex?: number;
}): EvidencePriorityItem;
