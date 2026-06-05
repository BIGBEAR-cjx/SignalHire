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
export type ResearchSourceGroup = ResearchCoverageItem & {
  latestKind: string;
  latestDetail: string;
};
export type RecentResearchItem = {
  id: number;
  kind: string;
  detail: string;
  sourceType: ResearchSourceType;
};
export type ResearchLoopRecentItem = RecentResearchItem & {
  label: string;
  sourceLabel: string;
  intent: string;
};
export type ResearchLoopPhase = {
  key: string;
  label: string;
  detail: string;
};
export type ResearchLoopStage = {
  key: string;
  state: "done" | "active" | "pending";
  label: string;
  detail: string;
};
export type ResearchObservableCard = {
  label: string;
  detail: string;
};
export type ResearchObservability = {
  canStop: boolean;
  currentSearch: ResearchObservableCard;
  currentFetch: ResearchObservableCard;
  coverage: ResearchObservableCard;
};
export type ResearchEvidenceTimelineItem = {
  id: number;
  stage: "search" | "read" | string;
  label: string;
  sourceType: ResearchSourceType;
  sourceLabel: string;
  detail: string;
  nextStep: string;
  state: "active" | "done" | string;
};
export type ResearchEvidenceTimelineSummary = {
  label: string;
  detail: string;
};
export type ResearchLoopView = {
  locale: ResearchLoopLocale;
  phase: ResearchLoopPhase;
  stageTimeline: ResearchLoopStage[];
  statsText: string;
  searches: number;
  fetches: number;
  recentItems: ResearchLoopRecentItem[];
  coverage: ResearchCoverageItem[];
  sourceGroups: ResearchSourceGroup[];
  observability: ResearchObservability;
  evidenceTimeline: ResearchEvidenceTimelineItem[];
  evidenceTimelineSummary: ResearchEvidenceTimelineSummary;
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
export type CandidateFeedbackOption = {
  value: string;
  label: string;
  selected: boolean;
};
export type CandidateFeedbackGroup = {
  key: string;
  label: string;
  options: CandidateFeedbackOption[];
};
export type CandidateFeedbackPanel = {
  locale: ResearchLoopLocale;
  candidateName: string;
  title: string;
  description: string;
  groups: CandidateFeedbackGroup[];
};
export type ProjectCandidateDecisionQueueItem = {
  id: string;
  status: string;
  name: string;
  subtitle: string;
  matchScore: number | null;
  reason: string;
  canBackfill: boolean;
  backfillInput: string;
};
export type ProjectCandidateDecisionQueueColumn = {
  key: string;
  title: string;
  count: number;
  items: ProjectCandidateDecisionQueueItem[];
};
export type ProjectCandidateDecisionQueue = {
  locale: ResearchLoopLocale;
  columns: ProjectCandidateDecisionQueueColumn[];
};
export type ProjectActionBriefAction = {
  key: string;
  count?: number;
  label: string;
  detail: string;
  targetItemId: string;
  backfillInput: string;
};
export type ProjectActionBrief = {
  locale: ResearchLoopLocale;
  title: string;
  summary: string;
  primaryAction: ProjectActionBriefAction;
  actions: ProjectActionBriefAction[];
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
export type ProjectCommandPriority = {
  key: string;
  label: string;
  detail: string;
};
export type ProjectCommandPriorities = {
  title: string;
  items: ProjectCommandPriority[];
};
export type ProjectSearchRefinementSuggestion = {
  key: string;
  label: string;
  detail: string;
  instruction: string;
};
export type ProjectSearchRefinementSuggestions = {
  locale: ResearchLoopLocale;
  title: string;
  items: ProjectSearchRefinementSuggestion[];
};
export type ProjectCandidateFeedbackSignal = {
  key: string;
  label: string;
  detail: string;
  instruction: string;
};
export type ProjectCandidateFeedbackSignals = {
  locale: ResearchLoopLocale;
  title: string;
  items: ProjectCandidateFeedbackSignal[];
  empty: boolean;
};
export type SearchConstraintChange = {
  key: string;
  type: "add" | "strengthen" | "reduce" | string;
  typeLabel: string;
  sourceLabel: string;
  label: string;
  detail: string;
};
export type NextSearchConstraintDiff = {
  locale: ResearchLoopLocale;
  title: string;
  originalTitle: string;
  optimizedTitle: string;
  originalInput: string;
  optimizedInput: string;
  editableHint: string;
  changes: SearchConstraintChange[];
  empty: boolean;
};
export type SearchConstraintEditorSection = {
  key: string;
  label: string;
  items: string[];
};
export type SearchConstraintEditor = {
  locale: ResearchLoopLocale;
  title: string;
  description: string;
  base: {
    label: string;
    value: string;
  };
  sections: SearchConstraintEditorSection[];
  empty: boolean;
};
export type ProjectSearchConsole = {
  locale: ResearchLoopLocale;
  title: string;
  description: string;
  briefTitle: string;
  briefText: string;
  latestRoundTitle: string;
  latestRoundEmpty: string;
  latestRound: null | {
    id: string;
    roundNumber: number;
    kind: "search" | "verify";
    badge: string;
    label: string;
    description: string;
    summary: string;
    status: string;
  };
  feedback: null | {
    title: string;
    items: Array<{
      key: string;
      label: string;
      value: string;
    }>;
  };
  nextSearchInput: string;
  refinementSuggestions: ProjectSearchRefinementSuggestions;
  candidateFeedbackSignals: ProjectCandidateFeedbackSignals;
  constraintDiff: NextSearchConstraintDiff;
  nextSteps: ProjectNextSteps;
  priorities: ProjectCommandPriorities;
};
export type ProjectControlRoomCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
};
export type ProjectControlRoom = {
  locale: ResearchLoopLocale;
  title: string;
  description: string;
  focusTitle: string;
  focus: {
    key: string;
    label: string;
    detail: string;
    actionDetail: string;
    targetItemId: string;
    backfillInput: string;
  };
  nextSteps: ProjectNextSteps;
  cards: ProjectControlRoomCard[];
};
export type ProjectDetailHierarchy = {
  locale: ResearchLoopLocale;
  primary: string[];
  secondary: string[];
  hidden: string[];
  notes: Record<string, string>;
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
export type ProjectFeedbackPreference = {
  locale: ResearchLoopLocale;
  canApply: boolean;
  title: string;
  detail: string;
  optimizedInput: string;
  items: Array<{
    key: string;
    label: string;
    value: string;
  }>;
};

export function buildResearchLoopView(input?: {
  feed?: ResearchLoopFeedItem[];
  live?: ResearchLoopLive;
  jobStatus?: ResearchLoopJobStatus;
  locale?: ResearchLoopLocale | string;
}): ResearchLoopView;
export function inferResearchCoverage(feed?: ResearchLoopFeedItem[]): ResearchCoverageItem[];
export function buildResearchSourceGroups(feed?: ResearchLoopFeedItem[], locale?: ResearchLoopLocale | string): ResearchSourceGroup[];
export function extractRecentResearchItems(feed?: ResearchLoopFeedItem[], locale?: ResearchLoopLocale | string): RecentResearchItem[];
export function buildFeedbackOptimizationPreview(input?: {
  feedback?: SearchFeedback;
  locale?: ResearchLoopLocale | string;
}): FeedbackOptimizationPreview;
export function buildCandidateFeedbackPanel(input?: {
  candidate?: unknown;
  feedback?: SearchFeedback;
  locale?: ResearchLoopLocale | string;
}): CandidateFeedbackPanel;
export function buildProjectCandidateDecisionQueue(input?: {
  items?: unknown[];
  locale?: ResearchLoopLocale | string;
}): ProjectCandidateDecisionQueue;
export function buildProjectActionBrief(input?: {
  items?: unknown[];
  locale?: ResearchLoopLocale | string;
}): ProjectActionBrief;
export function buildProjectSearchRefinementSuggestions(input?: {
  items?: unknown[];
  locale?: ResearchLoopLocale | string;
}): ProjectSearchRefinementSuggestions;
export function buildProjectCandidateFeedbackSignals(input?: {
  items?: unknown[];
  locale?: ResearchLoopLocale | string;
}): ProjectCandidateFeedbackSignals;
export function buildSearchConstraintEditor(input?: {
  input?: string;
  locale?: ResearchLoopLocale | string;
}): SearchConstraintEditor;
export function buildSearchInputFromConstraintEditor(input?: {
  editor?: {
    base?: { value?: string };
    sections?: Array<{ label?: string; items?: string[] }>;
  };
}): string;
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
export function buildProjectSearchConsole(input?: {
  project?: {
    name?: string;
    brief?: string | null;
  };
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
  items?: unknown[];
  candidateCount?: number;
  hasFilter?: boolean;
  locale?: ResearchLoopLocale | string;
}): ProjectSearchConsole;
export function buildProjectControlRoom(input?: {
  project?: {
    name?: string;
    brief?: string | null;
  };
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
  items?: unknown[];
  candidateCount?: number;
  hasFilter?: boolean;
  hasCandidateDecisionQueuePanel?: boolean;
  hasResearchRoundsPanel?: boolean;
  hasSearchConstraintDiffPanel?: boolean;
  hasProjectHeaderBrief?: boolean;
  hasCandidateFeedbackSignalsPanel?: boolean;
  locale?: ResearchLoopLocale | string;
}): ProjectControlRoom;
export function buildProjectDetailHierarchy(input?: {
  hasCandidates?: boolean;
  hasControlRoom?: boolean;
  hasProjectEvidenceMatrix?: boolean;
  hasStatusFunnel?: boolean;
  hasResearchRounds?: boolean;
  hasSearchConsolePriorities?: boolean;
  hasResearchRoundFeedback?: boolean;
  hasSearchConsoleFeedback?: boolean;
  hasConstraintDiffRefinements?: boolean;
  hasSearchRefinementSuggestions?: boolean;
  hasConstraintDiffCandidateFeedback?: boolean;
  hasCandidateFeedbackSignals?: boolean;
  hasHeaderBrief?: boolean;
  hasSearchConsoleBrief?: boolean;
  hasCandidateStatusTabs?: boolean;
  locale?: ResearchLoopLocale | string;
}): ProjectDetailHierarchy;
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
export function buildLatestProjectFeedbackPreference(input?: {
  runs?: Array<{
    updated_at?: string;
    result?: unknown;
  }>;
  baseInput?: string;
  locale?: ResearchLoopLocale | string;
}): ProjectFeedbackPreference;
