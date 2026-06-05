export type ResearchLoopLocale = "zh" | "en";
export type ResearchLoopFeedItem = { id?: number; kind?: string; info?: string };
export type ResearchLoopLive = { searches?: number; fetches?: number } | null;
export type ResearchLoopJobStatus = {
  phase?: string;
  label?: string;
  detail?: string;
  canRetry?: boolean;
} | null;

export type ResearchSourceType = "github" | "papers" | "company" | "public_web";
export type ResearchCoverageItem = {
  key: ResearchSourceType;
  label: string;
  count: number;
};
export type RecentResearchItem = {
  id: number;
  kind: string;
  detail: string;
  sourceType: ResearchSourceType;
};
export type ResearchLoopRecentItem = RecentResearchItem & {
  label: string;
};
export type ResearchLoopPhase = {
  key: string;
  label: string;
  detail: string;
};
export type ResearchLoopView = {
  locale: ResearchLoopLocale;
  phase: ResearchLoopPhase;
  statsText: string;
  searches: number;
  fetches: number;
  recentItems: ResearchLoopRecentItem[];
  coverage: ResearchCoverageItem[];
};

export type SearchFeedback = {
  precision?: "" | "accurate" | "partial" | "off" | string;
  satisfaction?: "" | "satisfied" | "mixed" | "unsatisfied" | string;
  issue?: "" | "too_broad" | "wrong_seniority" | "wrong_direction" | "weak_evidence" | "wrong_location" | "too_few" | "too_many" | string;
  focus?: "" | "stricter_match" | "expand_sources" | "stronger_evidence" | "adjacent_pools" | "higher_seniority" | "location_fit" | string;
};
export type FeedbackOptimizationAction = {
  key: string;
  label: string;
  detail: string;
};
export type FeedbackOptimizationPreview = {
  locale: ResearchLoopLocale;
  canRun: boolean;
  required: string[];
  statusText: string;
  actions: FeedbackOptimizationAction[];
};
export type PersistedSearchFeedback = {
  version: 1;
  precision: string;
  satisfaction: string;
  issue: string;
  focus: string;
  optimization_actions: string[];
  optimized_query: string;
  created_at: string;
};
export type ProjectNextStepAction = {
  key: string;
  label: string;
  detail: string;
};
export type ProjectNextSteps = {
  locale: ResearchLoopLocale;
  title: string;
  state: string;
  latestRunLabel: string;
  actions: ProjectNextStepAction[];
};
export type ProjectResearchRoundItem = {
  id: string;
  roundNumber: number;
  kind: "search" | "verify";
  variant: string;
  badge: string;
  label: string;
  summary: string;
  status: string;
  queryText: string;
  updatedAt: string;
  description: string;
  nextSearchInput: string;
  feedbackSummary: null | {
    title: string;
    items: Array<{
      key: string;
      label: string;
      value: string;
    }>;
  };
};
export type ProjectResearchRounds = {
  locale: ResearchLoopLocale;
  title: string;
  emptyText: string;
  items: ProjectResearchRoundItem[];
};

export function buildResearchLoopView(input?: {
  feed?: ResearchLoopFeedItem[];
  live?: ResearchLoopLive;
  jobStatus?: ResearchLoopJobStatus;
  locale?: ResearchLoopLocale | string;
}): ResearchLoopView;
export function inferResearchCoverage(feed?: ResearchLoopFeedItem[]): ResearchCoverageItem[];
export function extractRecentResearchItems(feed?: ResearchLoopFeedItem[], locale?: ResearchLoopLocale | string): RecentResearchItem[];
export function buildFeedbackOptimizationPreview(input?: {
  feedback?: SearchFeedback;
  locale?: ResearchLoopLocale | string;
}): FeedbackOptimizationPreview;
export function buildPersistedSearchFeedback(input?: {
  feedback?: SearchFeedback;
  optimizedInput?: string;
  createdAt?: string;
  locale?: ResearchLoopLocale | string;
}): PersistedSearchFeedback;
export function mergeSearchFeedbackIntoResult(input?: {
  result?: unknown;
  feedback?: SearchFeedback;
  optimizedInput?: string;
  createdAt?: string;
  locale?: ResearchLoopLocale | string;
}): Record<string, unknown> & { search_feedback: PersistedSearchFeedback };
export function buildProjectNextSteps(input?: {
  candidateCount?: number;
  runCount?: number;
  hasFilter?: boolean;
  latestRunLabel?: string;
  locale?: ResearchLoopLocale | string;
}): ProjectNextSteps;
export function buildProjectResearchRounds(input?: {
  runs?: Array<{
    id?: string;
    kind?: string;
    label?: string;
    summary?: string | null;
    status?: string;
    query_text?: string;
    updated_at?: string;
    result?: unknown;
  }>;
  locale?: ResearchLoopLocale | string;
}): ProjectResearchRounds;
