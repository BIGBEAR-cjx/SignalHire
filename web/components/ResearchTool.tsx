"use client";

// ResearchTool —— 搜人/核验通用工具组件。
// Phase 1.1: 把原 page.tsx 的搜索/验证/轮询逻辑抽出来, 由 mode prop 锁定模式。
// 搜索 → TalentMap + ShortlistCard 列表
// 核验 → TrustReportView
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiMail } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import {
  BackfillMergeSummaryView,
  CandidateCard,
  CandidateComparisonView,
  CandidateProfileView,
  CoverageBackfillView,
  EvidenceCoverageView,
  EvidenceGraphView,
  EvidencePriorityPanel,
  SearchPlanView,
  ShortlistDeliveryReportView,
  ShortlistCard,
  SourceExecutionView,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import OutreachModal from "@/components/OutreachModal";
import {
  EditableSearchPlanPanel,
  FeedbackOptimizationPreview,
  ProjectContextBanner,
  ProjectFeedbackPreferenceBanner,
  ResearchErrorPanel,
  ResearchInputStage,
  ResearchProcessPanel,
  ResearchResultShell,
  ResearchShareBar,
  type ProjectFeedbackPreferenceView,
} from "@/components/research-workspace";
import { Surface } from "@/components/ui/signal-ui";
import { buildBackfillMergeSummary, buildCoverageBackfillPlan, buildEditableSearchPlanDraft, buildFeedbackOptimizedSearchInput, buildSearchInputFromEditablePlan } from "@/lib/talent-profile.mjs";
import type { BackfillMergeSummary, CoverageBackfillJob, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
import { buildCandidateFeedbackPanel, buildFeedbackOptimizationPreview, buildResearchLoopView, buildSearchConstraintEditor, buildSearchInputFromConstraintEditor } from "@/lib/research-loop.mjs";
import { buildEvidencePriorityView } from "@/lib/evidence-priority.mjs";
import { extractPdfTextFromFile } from "@/lib/client-resume-extract";
import { MAX_RESUME_FILE_BYTES, detectSupportedResumeFileType } from "@/lib/resume-upload-constraints.mjs";

type FeedItem = { id: number; kind: "search" | "fetch"; info: string };
type SearchResult = { candidates?: Candidate[] } | TalentSearchResult;
type AppResult = SearchResult | VerifyReport;
type RunStats = { searches: number; fetches: number; cached?: boolean };
type ResearchStepEvent = { type: "step"; kind: "search" | "fetch"; info: string; searches: number; fetches: number };
type ResearchDoneEvent = { type: "done"; data: AppResult; stats?: RunStats | null; runId?: string | null };
type ResearchErrorEvent = { type: "error"; error?: string };
type ResearchEvent = ResearchStepEvent | ResearchDoneEvent | ResearchErrorEvent;
type QueueResponse = { queued?: boolean; jobId?: string; error?: string };
type ResumeExtractResponse = {
  text?: string;
  fileName?: string;
  truncated?: boolean;
  warning?: string;
  error?: string;
};
type JobStatusView = {
  phase: "queued" | "running" | "retrying" | "done" | "error" | "canceled";
  label: string;
  detail: string;
  canRetry: boolean;
};
type StatusResponse = {
  runId?: string;
  status?: string;
  progress?: { searches?: number; fetches?: number; recent?: Array<{ kind: "search" | "fetch"; info: string }> } | null;
  result?: AppResult;
  error?: string | null;
  last_error?: string | null;
  status_view?: JobStatusView;
};
type BackfillContext = { originalResult: TalentSearchResult; originalRunId: string | null; job: CoverageBackfillJob };
type VerifyUploadKind = "resume" | "supportingMaterial";
type MergeBackfillResponse = { merged?: boolean; runId?: string; result?: AppResult; mergeSummary?: BackfillMergeSummary; error?: string };
type SaveFeedbackResponse = { saved?: boolean; optimizedInput?: string; result?: AppResult; error?: string };
type EditableSearchPlanDraft = TalentSearchResult;
type EditableSourceStrategy = TalentSearchResult["search_plan"]["source_strategy"][number];
type SearchFeedbackState = {
  precision: "" | "accurate" | "partial" | "off";
  satisfaction: "" | "satisfied" | "mixed" | "unsatisfied";
  issue: "" | "too_broad" | "wrong_seniority" | "wrong_direction" | "weak_evidence" | "wrong_location" | "too_few" | "too_many" | "other";
  focus: "" | "stricter_match" | "expand_sources" | "stronger_evidence" | "adjacent_pools" | "higher_seniority" | "location_fit";
};
type SearchFeedbackField = keyof SearchFeedbackState;
type SearchFeedbackOption = { value: SearchFeedbackState[SearchFeedbackField]; labelKey: string };
type SearchFeedbackGroup = { key: SearchFeedbackField; labelKey: string; options: SearchFeedbackOption[] };
type CandidateDecision = "saved" | "needs_evidence" | "passed";
type CandidateFeedbackPanelView = {
  title: string;
  description: string;
  groups: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string; selected: boolean }>;
  }>;
};
type SearchConstraintEditorView = ReturnType<typeof buildSearchConstraintEditor>;

const WORKER_DELAY_MS = 2 * 60 * 1000;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;
const EMPTY_SEARCH_FEEDBACK: SearchFeedbackState = {
  precision: "",
  satisfaction: "",
  issue: "",
  focus: "",
};
const SEARCH_FEEDBACK_GROUPS: SearchFeedbackGroup[] = [
  {
    key: "precision",
    labelKey: "feedback.precision",
    options: [
      { value: "accurate", labelKey: "feedback.precision.accurate" },
      { value: "partial", labelKey: "feedback.precision.partial" },
      { value: "off", labelKey: "feedback.precision.off" },
    ],
  },
  {
    key: "satisfaction",
    labelKey: "feedback.satisfaction",
    options: [
      { value: "satisfied", labelKey: "feedback.satisfaction.satisfied" },
      { value: "mixed", labelKey: "feedback.satisfaction.mixed" },
      { value: "unsatisfied", labelKey: "feedback.satisfaction.unsatisfied" },
    ],
  },
  {
    key: "issue",
    labelKey: "feedback.issue",
    options: [
      { value: "too_broad", labelKey: "feedback.issue.too_broad" },
      { value: "wrong_seniority", labelKey: "feedback.issue.wrong_seniority" },
      { value: "wrong_direction", labelKey: "feedback.issue.wrong_direction" },
      { value: "weak_evidence", labelKey: "feedback.issue.weak_evidence" },
      { value: "wrong_location", labelKey: "feedback.issue.wrong_location" },
      { value: "too_few", labelKey: "feedback.issue.too_few" },
      { value: "too_many", labelKey: "feedback.issue.too_many" },
    ],
  },
  {
    key: "focus",
    labelKey: "feedback.focus",
    options: [
      { value: "stricter_match", labelKey: "feedback.focus.stricter_match" },
      { value: "expand_sources", labelKey: "feedback.focus.expand_sources" },
      { value: "stronger_evidence", labelKey: "feedback.focus.stronger_evidence" },
      { value: "adjacent_pools", labelKey: "feedback.focus.adjacent_pools" },
      { value: "higher_seniority", labelKey: "feedback.focus.higher_seniority" },
      { value: "location_fit", labelKey: "feedback.focus.location_fit" },
    ],
  },
];

function isVerifyReport(result: AppResult): result is VerifyReport {
  return "claims" in result;
}
function isTalentSearchResult(result: AppResult | null): result is TalentSearchResult {
  return Boolean(result && "talent_map" in result && "search_brief" in result && Array.isArray((result as TalentSearchResult).candidates));
}

function CandidateFeedbackControls({
  view,
  onSelect,
}: {
  view: CandidateFeedbackPanelView;
  onSelect: (key: string, value: string) => void;
}) {
  return (
    <section className="rounded-3xl border border-black/10 bg-white/86 p-4 shadow-[0_16px_42px_rgba(0,0,0,0.05)]">
      <p className="text-sm font-semibold text-[var(--sh-ink)]">{view.title}</p>
      <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{view.description}</p>
      <div className="mt-3 space-y-3">
        {view.groups.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{group.label}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.selected}
                  onClick={() => onSelect(group.key, option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                    option.selected
                      ? "bg-[var(--sh-ink)] text-white ring-[var(--sh-ink)]"
                      : "bg-white text-[var(--sh-muted)] ring-black/10 hover:bg-[var(--sh-faint)] hover:text-[var(--sh-ink)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CandidateReviewCommand({
  count,
  firstName,
  reviewed,
  onReview,
  onShowProcess,
}: {
  count: number;
  firstName: string;
  reviewed: number;
  onReview: () => void;
  onShowProcess: () => void;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-[var(--sh-ink)]">
            {t("result.reviewFlow.title", { count, name: firstName })}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{t("result.reviewFlow.desc")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReview}
            className="sh-primary-action px-4"
          >
            {reviewed > 0 ? t("result.reviewFlow.reviewNext") : t("result.reviewFlow.reviewFirst")}
          </button>
          <button
            type="button"
            onClick={onShowProcess}
            className="sh-secondary-action px-4"
          >
            {t("result.reviewFlow.process")}
          </button>
        </div>
      </div>
    </Surface>
  );
}

function AdvancedResultDetails({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: (open: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <details
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className="rounded-2xl border border-black/10 bg-white/78 p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-[var(--sh-ink)]">
        {t("result.reviewFlow.advancedTitle")}
      </summary>
      <div className="mt-4 space-y-5">{children}</div>
    </details>
  );
}

function CandidateReviewFlow({
  result,
  selectedIndex,
  shortlist,
  decisions,
  candidateFeedbackPanel,
  feedbackGroups,
  feedbackPreview,
  loading,
  onOpenCandidate,
  onAddToPool,
  onNeedEvidence,
  onPass,
  onOutreach,
  onFeedbackSelect,
  onRunFeedback,
}: {
  result: TalentSearchResult;
  selectedIndex: number;
  shortlist: number[];
  decisions: Record<number, CandidateDecision>;
  candidateFeedbackPanel: CandidateFeedbackPanelView | null;
  feedbackGroups: Array<{ key: string; label: string; options: Array<{ value: string; label: string; selected: boolean }> }>;
  feedbackPreview: ReturnType<typeof buildFeedbackOptimizationPreview>;
  loading: boolean;
  onOpenCandidate: (index: number) => void;
  onAddToPool: (index: number, candidate: TalentCandidate) => void;
  onNeedEvidence: (index: number, candidate: TalentCandidate, job?: CoverageBackfillJob) => void;
  onPass: (index: number) => void;
  onOutreach: () => void;
  onFeedbackSelect: (key: string, value: string) => void;
  onRunFeedback: () => void;
}) {
  const { locale, t } = useI18n();
  const selectedCandidate = result.candidates[selectedIndex] ?? result.candidates[0];
  const safeSelectedIndex = Math.max(0, result.candidates.indexOf(selectedCandidate));
  const reviewed = Object.keys(decisions).length;
  const isSaved = shortlist.includes(safeSelectedIndex);
  const decision = decisions[safeSelectedIndex];

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(280px,0.78fr)_minmax(0,1.22fr)]">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--sh-ink)]">{t("result.reviewFlow.queueTitle")}</h2>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
            {t("result.reviewFlow.progress", { reviewed, total: result.candidates.length })}
          </span>
        </div>
        <div className="space-y-2">
          {result.candidates.map((candidate, index) => (
            <ShortlistCard
              key={`${candidate.name}-${index}`}
              candidate={candidate}
              selected={index === safeSelectedIndex}
              onOpen={() => onOpenCandidate(index)}
              locale={locale}
            />
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-black/10 bg-white/86 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-[var(--sh-ink)]">{t("result.reviewFlow.detailTitle")}</h2>
            {(decision || isSaved) && (
              <span className="rounded-full bg-[var(--sh-canvas)] px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
                {isSaved ? t("result.reviewFlow.addToPool") : decision === "needs_evidence" ? t("result.reviewFlow.needEvidence") : t("result.reviewFlow.pass")}
              </span>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <button
              type="button"
              onClick={() => onAddToPool(safeSelectedIndex, selectedCandidate)}
              disabled={isSaved}
              className="rounded-full bg-[var(--sh-ink)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-default disabled:bg-gray-300"
            >
              {t("result.reviewFlow.addToPool")}
            </button>
            <button
              type="button"
              onClick={() => onNeedEvidence(safeSelectedIndex, selectedCandidate)}
              disabled={loading}
              className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("result.reviewFlow.needEvidence")}
            </button>
            <button
              type="button"
              onClick={() => onPass(safeSelectedIndex)}
              className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[var(--sh-muted)] ring-1 ring-black/10 transition hover:bg-neutral-50"
            >
              {t("result.reviewFlow.pass")}
            </button>
            {isSaved && (
              <button
                type="button"
                onClick={onOutreach}
                className="rounded-full bg-white px-3 py-2 text-sm font-semibold text-[var(--sh-ink)] ring-1 ring-black/10 transition hover:bg-neutral-50"
              >
                <FiMail className="mr-1.5 inline h-4 w-4 align-[-2px]" aria-hidden="true" />
                {t("result.reviewFlow.outreach")}
              </button>
            )}
          </div>
        </div>

        {candidateFeedbackPanel && reviewed > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-[var(--sh-ink)]">{t("result.reviewFlow.feedbackTitle")}</p>
            <CandidateFeedbackControls view={candidateFeedbackPanel} onSelect={onFeedbackSelect} />
          </section>
        )}
        {reviewed > 0 && (
          <FeedbackOptimizationPreview
            groups={feedbackGroups}
            preview={feedbackPreview}
            loading={loading}
            onSelect={onFeedbackSelect}
            onRun={onRunFeedback}
          />
        )}
        <EvidenceGraphView result={result} candidate={selectedCandidate} />
        <CandidateProfileView
          candidate={selectedCandidate}
          result={result}
          onBackfillJob={(job) => onNeedEvidence(safeSelectedIndex, selectedCandidate, job)}
          backfillDisabled={loading}
          locale={locale}
        />
      </div>
    </section>
  );
}

function userFacingStatus(view: JobStatusView, elapsedMs: number, t: (key: string, params?: Record<string, string | number>) => string): JobStatusView {
  if (view.phase === "queued" && elapsedMs > WORKER_DELAY_MS) {
    return {
      ...view,
      label: t("research.status.busy.label"),
      detail: t("research.status.busy.detail"),
    };
  }
  if (view.phase === "retrying" && elapsedMs > WORKER_DELAY_MS) {
    return {
      ...view,
      detail: t("research.status.retryingSlow.detail", { detail: view.detail }),
    };
  }
  return view;
}

export default function ResearchTool({
  mode,
  initialInput = "",
  autoRun = false,
  projectId,           // 在某项目上下文里搜/验 → 入队 + 收藏自动归项目
  projectName,         // 仅显示
  projectFeedbackPreference,
}: {
  mode: "search" | "verify";
  initialInput?: string;
  autoRun?: boolean; // 进页面就自动跑 (用于历史回放 / hero 提交带 query 过来)
  projectId?: string;
  projectName?: string;
  projectFeedbackPreference?: ProjectFeedbackPreferenceView | null;
}) {
  const { locale, t } = useI18n();
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AppResult | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<number[]>([]); // 已收藏的 candidate_index 集合
  const [savingIdx, setSavingIdx] = useState<Set<number>>(new Set()); // 正在写 API 的 index (防重复点击)
  const [outreachOpen, setOutreachOpen] = useState(false); // AI 外联弹窗
  const [stats, setStats] = useState<RunStats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [live, setLive] = useState<{ searches: number; fetches: number } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusView | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [backfillContext, setBackfillContext] = useState<BackfillContext | null>(null);
  const [backfillMergeSummary, setBackfillMergeSummary] = useState<BackfillMergeSummary | null>(null);
  const [mergingBackfill, setMergingBackfill] = useState(false);
  const [mergedOriginalRunId, setMergedOriginalRunId] = useState<string | null>(null);
  const [editablePlan, setEditablePlan] = useState<EditableSearchPlanDraft | null>(null);
  const [searchFeedback, setSearchFeedback] = useState<SearchFeedbackState>(EMPTY_SEARCH_FEEDBACK);
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeUploadMessage, setResumeUploadMessage] = useState("");
  const [resumeUploadWarning, setResumeUploadWarning] = useState("");
  const [resumeUploadError, setResumeUploadError] = useState("");
  const [verifyUploadKind, setVerifyUploadKind] = useState<VerifyUploadKind>("resume");
  const [candidateDecisions, setCandidateDecisions] = useState<Record<number, CandidateDecision>>({});
  const [advancedDetailsOpen, setAdvancedDetailsOpen] = useState(false);
  const idRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runTokenRef = useRef(0);
  const appliedPreferenceRef = useRef("");

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => stopPolling, []);
  useEffect(() => {
    const optimizedInput = projectFeedbackPreference?.optimizedInput?.trim();
    if (mode !== "search" || !optimizedInput) return;
    if (appliedPreferenceRef.current === optimizedInput) return;
    setInput((current) => {
      const currentInput = current.trim();
      const initial = initialInput.trim();
      if (currentInput && currentInput !== initial) return current;
      appliedPreferenceRef.current = optimizedInput;
      return optimizedInput;
    });
  }, [initialInput, mode, projectFeedbackPreference?.optimizedInput]);

  function beginPolling(jobId: string, context?: BackfillContext, token = runTokenRef.current) {
    stopPolling();
    const startedAt = Date.now();
    let pollFailures = 0;
    pollRef.current = setInterval(async () => {
      if (token !== runTokenRef.current) return;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > JOB_TIMEOUT_MS) {
        stopPolling();
        setError(t("research.status.timeout"));
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`/api/status?id=${encodeURIComponent(jobId)}&locale=${locale}`);
        const j: StatusResponse = await r.json();
        if (token !== runTokenRef.current) return;
        pollFailures = 0;
        if (j.status_view) setJobStatus(userFacingStatus(j.status_view, elapsedMs, t));
        const p = j.progress;
        if (p) {
          setLive({ searches: p.searches ?? 0, fetches: p.fetches ?? 0 });
          setFeed((p.recent ?? []).map((x, i) => ({ id: i, kind: x.kind, info: x.info })));
        }
        if (j.status === "done") {
          stopPolling();
          if (!j.result) { setError(t("research.error.emptyResult")); setLoading(false); return; }
          const mergeContext = context ?? backfillContext;
          if (mergeContext && isTalentSearchResult(j.result)) {
            setBackfillMergeSummary(buildBackfillMergeSummary({
              originalResult: mergeContext.originalResult,
              backfillResult: j.result,
              locale,
            }));
          }
          setResult(j.result);
          setStats(p ? { searches: p.searches ?? 0, fetches: p.fetches ?? 0 } : null);
          setRunId(j.runId ?? jobId);
          setLoading(false);
        } else if (j.status === "canceled") {
          stopPolling();
          if (j.status_view) setJobStatus(j.status_view);
          setLoading(false);
        } else if (j.status === "error") {
          stopPolling();
          setError(j.error || t("research.error.failed"));
          setLoading(false);
        }
      } catch {
        pollFailures += 1;
        if (pollFailures >= 3) {
          setJobStatus({
            phase: "queued",
            label: t("research.status.reconnect.label"),
            detail: t("research.status.reconnect.detail"),
            canRetry: false,
          });
        }
      }
    }, 2000);
  }

  async function run(override?: string, options: { preserveInput?: boolean } = {}) {
    const value = (override ?? input).trim();
    if (!value) return;
    const token = runTokenRef.current + 1;
    runTokenRef.current = token;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    if (override !== undefined && !options.preserveInput) setInput(value);
    stopPolling();
    setLoading(true); setError(""); setResult(null); setStats(null);
    setSelectedCandidateIndex(null); setShortlist([]);
    setFeed([]); setLive(null); setRunId(null); setCurrentJobId(null);
    setJobStatus(null); setCopied(false); setBackfillContext(null); setBackfillMergeSummary(null);
    setMergingBackfill(false); setMergedOriginalRunId(null);
    setSearchFeedback(EMPTY_SEARCH_FEEDBACK);
    setCandidateDecisions({});
    setAdvancedDetailsOpen(false);
    if (!options.preserveInput) setEditablePlan(null);
    try {
      const url = mode === "search" ? "/api/search" : "/api/verify";
      const body: Record<string, unknown> = mode === "search" ? { query: value, locale } : { bio: value, locale };
      if (projectId) body.project_id = projectId;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (token !== runTokenRef.current) return;
      const ct = res.headers.get("content-type") || "";

      if (ct.includes("ndjson") && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (token !== runTokenRef.current) return;
          if (done) break;
          buf += dec.decode(chunk, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            let ev: ResearchEvent;
            try { ev = JSON.parse(line); } catch { continue; }
            if (ev.type === "step") {
              setLive({ searches: ev.searches, fetches: ev.fetches });
              setFeed((f) => [...f, { id: idRef.current++, kind: ev.kind, info: ev.info }].slice(-50));
            } else if (ev.type === "done") {
              setResult(ev.data);
              setStats(ev.stats ?? null);
              setRunId(ev.runId ?? null);
              setBackfillMergeSummary(null);
              setMergedOriginalRunId(null);
            } else if (ev.type === "error") {
              setError(ev.error || t("research.error.generic"));
            }
          }
        }
        if (token === runTokenRef.current) setLoading(false);
      } else {
        const j: QueueResponse = await res.json().catch(() => ({}));
        if (token !== runTokenRef.current) return;
        if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); setLoading(false); return; }
        if (j.queued && j.jobId) {
          setCurrentJobId(j.jobId);
          setJobStatus({ phase: "queued", label: t("research.status.queued.label"), detail: t("research.status.queued.detail"), canRetry: false });
          beginPolling(j.jobId, undefined, token);
        } else {
          setError(j.error ?? t("research.error.generic")); setLoading(false);
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError" || token !== runTokenRef.current) return;
      setError((e as Error).message);
      setLoading(false);
    } finally {
      if (token === runTokenRef.current) abortRef.current = null;
    }
  }

  function buildSupportingMaterialInput(text: string, fileName: string) {
    return [
      t("research.supportingMaterialPrefillHeader"),
      "",
      t("research.supportingMaterialUploadSelected", { name: fileName }),
      "",
      text,
    ].join("\n");
  }

  async function uploadVerificationFile(file: File, kind: VerifyUploadKind = "resume") {
    if (mode !== "verify" || loading || resumeUploading) return;
    setVerifyUploadKind(kind);
    const fileType = detectSupportedResumeFileType(file.name, file.type);
    if (!fileType) {
      setResumeUploadError(t("api.error.resumeUnsupportedType"));
      return;
    }
    if (file.size > MAX_RESUME_FILE_BYTES) {
      setResumeUploadError(t("api.error.resumeTooLarge"));
      return;
    }
    setResumeUploading(true);
    setResumeUploadMessage("");
    setResumeUploadWarning("");
    setResumeUploadError("");
    setError("");
    try {
      if (fileType === "pdf") {
        const data = await extractPdfTextFromFile(file);
        if (!data.text.trim()) {
          setResumeUploadError(t("api.error.resumeEmptyText"));
          return;
        }
        const inputText = kind === "supportingMaterial" ? buildSupportingMaterialInput(data.text, file.name) : data.text;
        setInput(inputText);
        setResumeUploadMessage(t(kind === "supportingMaterial" ? "research.supportingMaterialUploadSelected" : "research.resumeUploadSelected", { name: file.name }));
        setResumeUploadWarning(data.truncated ? t("research.resumeUploadTruncated") : "");
        setResumeUploading(false);
        await run(inputText);
        return;
      }

      const form = new FormData();
      form.set("file", file);
      form.set("locale", locale);
      const res = await fetch(`/api/verify/extract?locale=${locale}`, { method: "POST", body: form });
      const data: ResumeExtractResponse = await res.json().catch(() => ({}));
      if (!res.ok || !data.text?.trim()) {
        setResumeUploadError(data.error || t("api.error.resumeParseFailed"));
        return;
      }
      const fileName = data.fileName || file.name;
      const inputText = kind === "supportingMaterial" ? buildSupportingMaterialInput(data.text, fileName) : data.text;
      setInput(inputText);
      setResumeUploadMessage(t(kind === "supportingMaterial" ? "research.supportingMaterialUploadSelected" : "research.resumeUploadSelected", { name: fileName }));
      setResumeUploadWarning(data.warning || (data.truncated ? t("research.resumeUploadTruncated") : ""));
      setResumeUploading(false);
      await run(inputText);
    } catch {
      setResumeUploadError(t("api.error.resumeParseFailed"));
    } finally {
      setResumeUploading(false);
    }
  }

  function splitPlanText(value: string) {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }

  function joinPlanText(items: string[]) {
    return items.join("\n");
  }

  function createEditablePlan() {
    if (!input.trim()) return;
    setEditablePlan(buildEditableSearchPlanDraft(input, { locale }));
  }

  function updateEditablePlanList(key: "must_have" | "nice_to_have" | "exclusions", value: string) {
    setEditablePlan((draft) => draft ? {
      ...draft,
      search_plan: {
        ...draft.search_plan,
        [key]: splitPlanText(value),
      },
    } : draft);
  }

  function updateEditableSource(index: number, patch: Partial<EditableSourceStrategy>) {
    setEditablePlan((draft) => draft ? {
      ...draft,
      search_plan: {
        ...draft.search_plan,
        source_strategy: draft.search_plan.source_strategy.map((source, i) => i === index ? { ...source, ...patch } : source),
      },
    } : draft);
  }

  function runEditablePlan() {
    if (!editablePlan) return;
    run(buildSearchInputFromEditablePlan({ draft: editablePlan, locale }), { preserveInput: true });
  }

  function updateConstraintEditorBase(editor: SearchConstraintEditorView, value: string) {
    setInput(buildSearchInputFromConstraintEditor({
      editor: {
        ...editor,
        base: { ...editor.base, value },
      },
    }));
  }

  function updateConstraintEditorSection(editor: SearchConstraintEditorView, key: string, value: string) {
    setInput(buildSearchInputFromConstraintEditor({
      editor: {
        ...editor,
        sections: editor.sections.map((section) => section.key === key
          ? { ...section, items: splitPlanText(value) }
          : section),
      },
    }));
  }

  function updateSearchFeedback(key: SearchFeedbackField, value: SearchFeedbackState[SearchFeedbackField]) {
    setSearchFeedback((current) => ({
      ...current,
      [key]: current[key] === value ? "" : value,
    }));
  }

  async function runFeedbackOptimizedSearch() {
    if (!isTalentSearchResult(result)) return;
    let optimizedInput = buildFeedbackOptimizedSearchInput({ result, feedback: searchFeedback, locale });
    if (runId) {
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: runId, locale, feedback: searchFeedback }),
        });
        const saved: SaveFeedbackResponse = await res.json().catch(() => ({}));
        if (res.ok && saved.saved) {
          if (typeof saved.optimizedInput === "string" && saved.optimizedInput.trim()) {
            optimizedInput = saved.optimizedInput;
          }
          if (saved.result) setResult(saved.result);
        }
      } catch {}
    }
    setInput(optimizedInput);
    run(optimizedInput, { preserveInput: true });
  }

  function stopCurrentRun() {
    const jobId = currentJobId;
    runTokenRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    stopPolling();
    setLoading(false);
    setError("");
    setJobStatus({
      phase: "canceled",
      label: t("research.status.canceled.label"),
      detail: t("research.status.canceled.detail"),
      canRetry: false,
    });
    setCurrentJobId(null);
    if (jobId) {
      fetch("/api/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: jobId, locale }),
      }).catch(() => {});
    }
  }

  async function retryCurrentJob() {
    if (!currentJobId) return;
    stopPolling();
    setLoading(true); setError(""); setResult(null); setFeed([]); setLive(null);
    setJobStatus({ phase: "queued", label: t("research.status.requeued.label"), detail: t("research.status.requeued.detail"), canRetry: false });
    try {
      const res = await fetch("/api/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentJobId, locale }),
      });
      const j: StatusResponse & { retried?: boolean } = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error || `HTTP ${res.status}`); setLoading(false); return; }
      if (j.status_view) setJobStatus(j.status_view);
      beginPolling(currentJobId);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function enqueueBackfillJob(job: CoverageBackfillJob) {
    if (loading || !isTalentSearchResult(result)) return;
    stopPolling();
    setLoading(true); setError(""); setStats(null); setFeed([]); setLive(null);
    setJobStatus({ phase: "queued", label: t("research.status.backfillQueued.label"), detail: t("research.status.backfillQueued.detail"), canRetry: false });
    setCurrentJobId(null);
    const context = { originalResult: result, originalRunId: runId, job };
    setBackfillContext(context);
    setBackfillMergeSummary(null);
    setMergedOriginalRunId(null);
    try {
      const res = await fetch("/api/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job,
          locale,
          original_query: result.search_brief.original_query || input,
          source_run_id: runId,
          ...(projectId ? { project_id: projectId } : {}),
        }),
      });
      const j: QueueResponse = await res.json().catch(() => ({}));
      if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); setLoading(false); return; }
      if (j.queued && j.jobId) {
        setCurrentJobId(j.jobId);
        beginPolling(j.jobId, context);
      } else {
        setError(j.error ?? t("research.error.backfillQueued")); setLoading(false);
      }
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  async function mergeBackfillIntoOriginal() {
    if (!backfillContext?.originalRunId || !runId || mergingBackfill) return;
    setMergingBackfill(true); setError("");
    try {
      const res = await fetch("/api/backfill/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          original_run_id: backfillContext.originalRunId,
          locale,
          backfill_run_id: runId,
        }),
      });
      const j: MergeBackfillResponse = await res.json().catch(() => ({}));
      if (!res.ok || !j.merged || !j.result || !j.runId) {
        setError(j.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult(j.result);
      setRunId(j.runId);
      setBackfillMergeSummary(j.mergeSummary ?? backfillMergeSummary);
      setMergedOriginalRunId(j.runId);
      setBackfillContext(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMergingBackfill(false);
    }
  }

  // 进页面就自动跑 (hero 跳过来 / 历史回放)
  const ranAuto = useRef(false);
  useEffect(() => {
    if (autoRun && initialInput && !ranAuto.current) {
      ranAuto.current = true;
      run(initialInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, initialInput]);

  // 拿到结果 (search) 且有 runId → 加载该用户已收藏的 candidate_index 集合, 回填高亮
  useEffect(() => {
    if (mode !== "search") return;
    if (!runId) return;
    let cancelled = false;
    fetch(`/api/shortlist?run=${encodeURIComponent(runId)}&locale=${locale}`)
      .then((r) => r.ok ? r.json() : { indices: [] })
      .then((j) => { if (!cancelled) setShortlist(Array.isArray(j.indices) ? j.indices : []); })
      .catch(() => { if (!cancelled) setShortlist([]); });
    return () => { cancelled = true; };
  }, [locale, mode, runId]);

  useEffect(() => {
    if (!isTalentSearchResult(result)) return;
    if (result.candidates.length === 0) return;
    if (selectedCandidateIndex === null || selectedCandidateIndex >= result.candidates.length) {
      setSelectedCandidateIndex(0);
    }
  }, [result, selectedCandidateIndex]);

  // 收藏 toggle: 调 API 持久化 + 乐观更新; 失败回滚。
  async function toggleShortlist(idx: number, candidate: unknown) {
    if (savingIdx.has(idx)) return;
    const wasSaved = shortlist.includes(idx);
    // 乐观更新
    setShortlist((items) => wasSaved ? items.filter((i) => i !== idx) : [...items, idx]);
    setSavingIdx((s) => { const n = new Set(s); n.add(idx); return n; });
    try {
      if (wasSaved) {
        const r = await fetch(`/api/shortlist?run=${encodeURIComponent(runId ?? "")}&idx=${idx}&locale=${locale}`, { method: "DELETE" });
        if (!r.ok) throw new Error("delete failed");
      } else {
        const r = await fetch("/api/shortlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_run_id: runId,
            candidate_index: idx,
            candidate,
            locale,
            ...(projectId ? { project_id: projectId } : {}),
          }),
        });
        if (!r.ok) throw new Error("save failed");
      }
    } catch {
      // 回滚
      setShortlist((items) => wasSaved ? [...items, idx] : items.filter((i) => i !== idx));
    } finally {
      setSavingIdx((s) => { const n = new Set(s); n.delete(idx); return n; });
    }
  }

  function openCandidateForReview(index: number) {
    setSelectedCandidateIndex(index);
  }

  async function addCandidateToPool(index: number, candidate: TalentCandidate) {
    if (!shortlist.includes(index)) {
      await toggleShortlist(index, candidate);
    }
    setCandidateDecisions((current) => ({ ...current, [index]: "saved" }));
  }

  function candidateBackfillJob(candidate: TalentCandidate, explicitJob?: CoverageBackfillJob): CoverageBackfillJob | null {
    if (explicitJob) return explicitJob;
    if (!isTalentSearchResult(result)) return null;
    const jobs = buildCoverageBackfillPlan(result, { locale }).jobs.filter((job: CoverageBackfillJob) => job.status === "planned");
    return jobs.find((job: CoverageBackfillJob) => job.candidate_names.includes(candidate.name)) ?? jobs[0] ?? null;
  }

  function needEvidenceForCandidate(index: number, candidate: TalentCandidate, explicitJob?: CoverageBackfillJob) {
    setCandidateDecisions((current) => ({ ...current, [index]: "needs_evidence" }));
    const job = candidateBackfillJob(candidate, explicitJob);
    if (job) {
      void enqueueBackfillJob(job);
    } else {
      setAdvancedDetailsOpen(true);
    }
  }

  function passCandidate(index: number) {
    setCandidateDecisions((current) => ({ ...current, [index]: "passed" }));
  }

  function reviewPrimaryCandidate() {
    if (!isTalentSearchResult(result) || result.candidates.length === 0) return;
    const start = selectedCandidateIndex === null ? 0 : selectedCandidateIndex + 1;
    const next = result.candidates.findIndex((_, index) => index >= start && !candidateDecisions[index]);
    setSelectedCandidateIndex(next >= 0 ? next : 0);
  }

  const isSearch = mode === "search";
  const progressView = buildResearchLoopView({ feed, live, jobStatus, locale });
  const feedbackPreview = buildFeedbackOptimizationPreview({ feedback: searchFeedback, locale });
  const evidencePriorityView = isTalentSearchResult(result) ? buildEvidencePriorityView({ result, locale }) : null;
  const constraintEditor = isSearch && !loading && !result
    ? buildSearchConstraintEditor({ input, locale })
    : null;
  const selectedTalentCandidate = isTalentSearchResult(result) && selectedCandidateIndex !== null
    ? result.candidates[selectedCandidateIndex] ?? null
    : null;
  const candidateFeedbackPanel = selectedTalentCandidate
    ? buildCandidateFeedbackPanel({ candidate: selectedTalentCandidate, feedback: searchFeedback, locale })
    : null;
  const feedbackGroups = SEARCH_FEEDBACK_GROUPS.map((group) => ({
    key: group.key,
    label: t(group.labelKey),
    options: group.options.map((option) => ({
      value: String(option.value),
      label: t(option.labelKey),
      selected: searchFeedback[group.key] === option.value,
    })),
  }));

  return (
    <div className="space-y-5">
      {projectId && (
        <ProjectContextBanner
          projectId={projectId}
          projectName={projectName}
          mode={mode}
        />
      )}

      {isSearch && projectFeedbackPreference && (
        <ProjectFeedbackPreferenceBanner preference={projectFeedbackPreference} />
      )}

      <ResearchInputStage
        mode={mode}
        input={input}
        onInputChange={setInput}
        onRun={() => run()}
        onCreatePlan={isSearch ? createEditablePlan : undefined}
        loading={loading}
        onResumeUpload={mode === "verify" ? (file) => uploadVerificationFile(file, "resume") : undefined}
        onSupportingMaterialUpload={mode === "verify" ? (file) => uploadVerificationFile(file, "supportingMaterial") : undefined}
        activeUploadKind={verifyUploadKind}
        resumeUploading={resumeUploading}
        resumeUploadMessage={resumeUploadMessage}
        resumeUploadWarning={resumeUploadWarning}
        resumeUploadError={resumeUploadError}
      />

      {constraintEditor && constraintEditor.sections.length > 0 && (
        <Surface className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{constraintEditor.title}</p>
              <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{constraintEditor.description}</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
              {constraintEditor.sections.length}
            </span>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <label className="block">
              <span className="text-xs font-semibold text-[var(--sh-muted)]">{constraintEditor.base.label}</span>
              <textarea
                value={constraintEditor.base.value}
                onChange={(event) => updateConstraintEditorBase(constraintEditor, event.target.value)}
                rows={5}
                className="mt-2 block w-full resize-y rounded-2xl border border-black/10 bg-white/78 px-3 py-3 text-sm leading-6 text-[var(--sh-ink)] outline-none transition focus:border-black/20 focus:bg-white"
              />
            </label>
            <div className="grid gap-3">
              {constraintEditor.sections.map((section) => (
                <label key={section.key} className="block rounded-2xl border border-black/10 bg-white/70 p-3">
                  <span className="text-xs font-semibold text-[var(--sh-muted)]">{section.label}</span>
                  <textarea
                    value={joinPlanText(section.items)}
                    onChange={(event) => updateConstraintEditorSection(constraintEditor, section.key, event.target.value)}
                    rows={Math.max(3, section.items.length + 1)}
                    className="mt-2 block w-full resize-y rounded-xl border border-black/10 bg-[var(--sh-canvas)] px-3 py-2 text-sm leading-6 text-[var(--sh-ink)] outline-none transition focus:border-black/20 focus:bg-white"
                  />
                </label>
              ))}
            </div>
          </div>
        </Surface>
      )}

      {isSearch && editablePlan && (
        <EditableSearchPlanPanel onRunPlan={runEditablePlan} loading={loading}>
          <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-emerald-700">{t("research.plan.mustHave")}</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.must_have)}
                  onChange={(e) => updateEditablePlanList("must_have", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-950 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-blue-700">{t("research.plan.niceToHave")}</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.nice_to_have)}
                  onChange={(e) => updateEditablePlanList("nice_to_have", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm text-blue-950 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-red-700">{t("research.plan.exclusions")}</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.exclusions)}
                  onChange={(e) => updateEditablePlanList("exclusions", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm text-red-950 outline-none transition focus:border-red-500 focus:bg-white"
                />
              </label>
            </div>
            <div className="mt-4 space-y-3">
              {editablePlan.search_plan.source_strategy.map((source, index) => (
                <div key={`${source.coverage_group}-${source.source_type}-${index}`} className="grid gap-2 border-t border-gray-100 pt-3 md:grid-cols-[140px_minmax(0,1fr)]">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{source.coverage_group}</p>
                    <input
                      value={source.source_type}
                      onChange={(e) => updateEditableSource(index, { source_type: e.target.value })}
                      className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-gray-900"
                    />
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <input
                      value={source.target}
                      onChange={(e) => updateEditableSource(index, { target: e.target.value })}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-900"
                    />
                    <input
                      value={source.reason}
                      onChange={(e) => updateEditableSource(index, { reason: e.target.value })}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-900"
                    />
                    <textarea
                      value={source.query}
                      onChange={(e) => updateEditableSource(index, { query: e.target.value })}
                      rows={2}
                      className="rounded-lg border border-gray-200 px-3 py-2 font-mono text-xs text-gray-700 outline-none focus:border-gray-900 md:col-span-2"
                    />
                  </div>
                </div>
              ))}
            </div>
        </EditableSearchPlanPanel>
      )}

      {/* 进度区 */}
      {loading && (
        <ResearchProcessPanel
          phaseLabel={progressView.phase.label}
          phaseDetail={progressView.phase.detail}
          stageTimeline={progressView.stageTimeline}
          statsText={progressView.statsText}
          sourceGroups={progressView.sourceGroups}
          recentItems={progressView.recentItems}
          observability={progressView.observability}
          evidenceTimeline={progressView.evidenceTimeline}
          evidenceTimelineSummary={progressView.evidenceTimelineSummary}
          statusDetail={jobStatus?.detail ?? undefined}
          onStop={stopCurrentRun}
        />
      )}

      {!loading && jobStatus?.phase === "canceled" && (
        <div className="rounded-3xl border border-amber-100 bg-amber-50/90 p-4 text-sm text-amber-800">
          <p>{jobStatus.detail}</p>
        </div>
      )}

      {/* 错误区 */}
      {error && (
        <ResearchErrorPanel
          error={error}
          canRetry={Boolean(jobStatus?.canRetry && currentJobId)}
          onRetry={jobStatus?.canRetry && currentJobId ? retryCurrentJob : undefined}
        />
      )}

      {/* 结果区 */}
      {result && (
        <ResearchResultShell>
          <ResearchShareBar
            statsText={stats ? t("research.stats", { searches: stats.searches, fetches: stats.fetches }) : undefined}
            cached={Boolean(stats?.cached)}
            copied={copied}
            onCopy={runId ? () => {
                  navigator.clipboard?.writeText(`${location.origin}/r/${runId}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } : undefined}
          />
          {isTalentSearchResult(result) ? (
            <>
              {backfillMergeSummary && (
                <BackfillMergeSummaryView
                  summary={backfillMergeSummary}
                  onMerge={backfillContext?.originalRunId && runId ? mergeBackfillIntoOriginal : undefined}
                  mergeDisabled={mergingBackfill}
                  merged={Boolean(mergedOriginalRunId)}
                  locale={locale}
                />
              )}
              {result.candidates.length > 0 ? (
                <>
                  <CandidateReviewCommand
                    count={result.candidates.length}
                    firstName={result.candidates[0]?.name ?? t("result.unknownCandidate")}
                    reviewed={Object.keys(candidateDecisions).length}
                    onReview={reviewPrimaryCandidate}
                    onShowProcess={() => setAdvancedDetailsOpen(true)}
                  />
                  <CandidateReviewFlow
                    result={result}
                    selectedIndex={selectedCandidateIndex ?? 0}
                    shortlist={shortlist}
                    decisions={candidateDecisions}
                    candidateFeedbackPanel={candidateFeedbackPanel}
                    feedbackGroups={feedbackGroups}
                    feedbackPreview={feedbackPreview}
                    loading={loading}
                    onOpenCandidate={openCandidateForReview}
                    onAddToPool={addCandidateToPool}
                    onNeedEvidence={needEvidenceForCandidate}
                    onPass={passCandidate}
                    onOutreach={() => setOutreachOpen(true)}
                    onFeedbackSelect={(key, value) => updateSearchFeedback(key as SearchFeedbackField, value as SearchFeedbackState[SearchFeedbackField])}
                    onRunFeedback={runFeedbackOptimizedSearch}
                  />
                </>
              ) : (
                <Surface className="p-5 text-sm leading-6 text-[var(--sh-muted)]">
                  {t("result.reviewFlow.empty")}
                </Surface>
              )}
              <AdvancedResultDetails open={advancedDetailsOpen} onToggle={setAdvancedDetailsOpen}>
                <SearchPlanView result={result} locale={locale} />
                <ShortlistDeliveryReportView result={result} locale={locale} />
                <SourceExecutionView result={result} locale={locale} />
                <CoverageBackfillView result={result} onBackfillJob={enqueueBackfillJob} backfillDisabled={loading} locale={locale} />
                <EvidenceCoverageView result={result} locale={locale} />
                <TalentMapView result={result} locale={locale} />
                <CandidateComparisonView result={result} locale={locale} />
                {evidencePriorityView && (
                  <EvidencePriorityPanel
                    view={evidencePriorityView}
                    onOpenCandidate={(item) => {
                      if (item.candidate_index >= 0 && item.candidate_index < result.candidates.length) {
                        openCandidateForReview(item.candidate_index);
                      }
                    }}
                    locale={locale}
                  />
                )}
              </AdvancedResultDetails>
            </>
          ) : isVerifyReport(result) ? (
            <TrustReportView r={result} locale={locale} />
          ) : (
            (result.candidates ?? []).map((c: Candidate, i: number) => <CandidateCard key={i} c={c} delay={i * 90} locale={locale} />)
          )}
        </ResearchResultShell>
      )}

      {/* AI 外联弹窗 (针对搜人结果里选中的候选人) */}
      {isTalentSearchResult(result) && selectedCandidateIndex !== null && (
        <OutreachModal
          open={outreachOpen}
          onClose={() => setOutreachOpen(false)}
          candidate={result.candidates[selectedCandidateIndex]}
          candidateName={result.candidates[selectedCandidateIndex]?.name}
          roleBrief={result.search_brief.original_query}
        />
      )}
    </div>
  );
}
