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
export function buildProjectNextSteps(input?: {
  candidateCount?: number;
  runCount?: number;
  hasFilter?: boolean;
  latestRunLabel?: string;
  locale?: ResearchLoopLocale | string;
}): ProjectNextSteps;
