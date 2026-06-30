export type ReferralPathType = "shared_company" | "shared_school" | "shared_project" | "known_candidate" | "manual_seed";

export type NormalizedNetworkSeed = {
  label: string;
  relation: string;
  linkedin_url: string;
  companies: string[];
  schools: string[];
  projects: string[];
};

export type ReferralPathView = {
  candidate_id: string;
  candidate_name: string;
  paths: Array<{
    path_type: ReferralPathType;
    shared_context: string;
    introducer_label: string;
    confidence: "high" | "medium" | "low";
    intro_snippet: string;
    client_safe: boolean;
  }>;
};

export function normalizeNetworkSeed(seed?: unknown): NormalizedNetworkSeed;
export function parseNetworkSeedCsv(text?: string): NormalizedNetworkSeed[];
export function buildReferralPathViews(input?: {
  candidates?: unknown[];
  networkSeeds?: unknown[];
  locale?: "zh" | "en";
}): ReferralPathView[];
