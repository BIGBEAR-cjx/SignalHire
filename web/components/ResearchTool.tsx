"use client";

// ResearchTool —— 搜人/核验通用工具组件。
// Phase 1.1: 把原 page.tsx 的搜索/验证/轮询逻辑抽出来, 由 mode prop 锁定模式。
// 搜索 → TalentMap + ShortlistCard 列表
// 核验 → TrustReportView
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FiCheckCircle, FiChevronDown, FiPlay, FiSliders } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import {
  BackfillMergeSummaryView,
  CandidateCard,
  CandidateComparisonView,
  CoverageBackfillView,
  EvidenceCoverageView,
  EvidencePriorityPanel,
  SearchPlanView,
  SearchResultWorkspaceView,
  ShortlistDeliveryReportView,
  SourceExecutionView,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import OutreachModal from "@/components/OutreachModal";
import {
  EditableSearchPlanPanel,
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
import {
  answerSearchIntakeQuestion,
  buildBackfillMergeSummary,
  buildCoverageBackfillPlan,
  buildEditableSearchPlanDraft,
  buildSearchInputFromEditablePlan,
  buildSearchInputFromSearchIntake,
  buildSearchIntakeDraft,
  buildSearchIntakeQuestions,
} from "@/lib/talent-profile.mjs";
import type { BackfillMergeSummary, CoverageBackfillJob, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
import { buildResearchLoopView, buildSearchConstraintEditor, buildSearchInputFromConstraintEditor } from "@/lib/research-loop.mjs";
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
type EditableSearchPlanDraft = TalentSearchResult;
type EditableSourceStrategy = TalentSearchResult["search_plan"]["source_strategy"][number];
type SearchIntakeQuestion = {
  key: "location" | "salary" | "target_count";
  question: string;
  reason: string;
  options: Array<{ value: string; label: string }>;
  allow_custom: boolean;
  skippable: boolean;
};
type SearchIntakeDraft = {
  original_query: string;
  role_title: string;
  role_category?: string;
  role_category_label?: string;
  employer_context?: string[];
  candidate_requirements?: string[];
  negative_constraints?: string[];
  raw_noise?: string[];
  channel_plan?: Array<{ key: string; label: string; target: string; coverage_group: string; source_types: string[] }>;
  query_clusters?: Array<{ key: string; label: string; query_variants: string[] }>;
  score_dimensions?: Array<{ key: string; label: string; weight: number }>;
  must_have: string[];
  nice_to_have: string[];
  exclusions: string[];
  unknowns: Array<SearchIntakeQuestion["key"]>;
  clarification: Partial<Record<SearchIntakeQuestion["key"], string>>;
  skipped_questions: SearchIntakeQuestion["key"][];
};
type CandidateDecision = "saved" | "needs_evidence" | "passed";
type SearchConstraintEditorView = ReturnType<typeof buildSearchConstraintEditor>;
const buildIntakeSearchInput = buildSearchInputFromSearchIntake as (input: { draft: SearchIntakeDraft; locale: string }) => string;

const WORKER_DELAY_MS = 2 * 60 * 1000;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

function isVerifyReport(result: AppResult): result is VerifyReport {
  return "claims" in result;
}
function isTalentSearchResult(result: AppResult | null): result is TalentSearchResult {
  return Boolean(result && "talent_map" in result && "search_brief" in result && Array.isArray((result as TalentSearchResult).candidates));
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

function SearchIntakePanel({
  draft,
  questions,
  loading,
  onAnswer,
  onCustomAnswer,
  onSkip,
  onRun,
  onOpenAdvanced,
}: {
  draft: SearchIntakeDraft;
  questions: SearchIntakeQuestion[];
  loading: boolean;
  onAnswer: (question: SearchIntakeQuestion, option: { value: string; label: string }) => void;
  onCustomAnswer: (question: SearchIntakeQuestion, value: string) => void;
  onSkip: (question: SearchIntakeQuestion) => void;
  onRun: () => void;
  onOpenAdvanced: () => void;
}) {
  const { locale, t } = useI18n();
  const [customValue, setCustomValue] = useState("");
  const currentQuestion = questions[0] ?? null;
  const clarificationSummary = Object.entries(draft.clarification).filter((entry): entry is [SearchIntakeQuestion["key"], string] => Boolean(entry[1]));
  const roleCategoryLabel = draft.role_category_label || draft.role_category || "";
  const employerContext = Array.isArray(draft.employer_context) ? draft.employer_context : [];
  const channelPlan = Array.isArray(draft.channel_plan) ? draft.channel_plan : [];

  function submitCustom() {
    if (!currentQuestion || !customValue.trim()) return;
    onCustomAnswer(currentQuestion, customValue);
    setCustomValue("");
  }

  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("research.intake.eyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--sh-ink)]">{t("research.intake.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{t("research.intake.description")}</p>
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={loading}
          className="sh-primary-action shrink-0 px-4"
        >
          <FiPlay aria-hidden="true" />
          {t("research.intake.searchNow")}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-black/10 bg-white/74 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("research.intake.understanding")}</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--sh-ink)]">{draft.role_title}</h3>
            {roleCategoryLabel ? (
              <p className="mt-1 text-xs font-semibold text-[var(--sh-muted)]">
                {roleCategoryLabel}
              </p>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            <FiCheckCircle aria-hidden="true" />
            {t("research.intake.parsed")}
          </span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <IntakeList title={t("research.intake.mustHave")} tone="emerald" items={draft.must_have} fallback={t("research.intake.empty")} />
          <IntakeList title={t("research.intake.niceToHave")} tone="blue" items={draft.nice_to_have} fallback={t("research.intake.empty")} />
          <IntakeList title={t("research.intake.exclusions")} tone="red" items={draft.exclusions} fallback={t("research.intake.empty")} />
        </div>
        {(employerContext.length > 0 || channelPlan.length > 0) && (
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            {employerContext.length > 0 && (
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-xs font-semibold text-[var(--sh-muted)]">{locale === "en" ? "Employer context" : "雇主背景"}</p>
                <div className="mt-2 space-y-1 text-sm leading-6 text-[var(--sh-ink)]">
                  {employerContext.slice(0, 3).map((item) => (
                    <p key={item}>{item}</p>
                  ))}
                </div>
              </div>
            )}
            {channelPlan.length > 0 && (
              <div className="rounded-2xl border border-black/10 bg-white p-3">
                <p className="text-xs font-semibold text-[var(--sh-muted)]">{locale === "en" ? "Channel plan" : "渠道计划"}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {channelPlan.slice(0, 6).map((item) => (
                    <span key={item.key} className="rounded-full bg-[var(--sh-faint)] px-3 py-1 text-xs font-semibold text-[var(--sh-ink)] ring-1 ring-black/10" title={item.target}>
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {(draft.unknowns.length > 0 || clarificationSummary.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {clarificationSummary.map(([key, value]) => (
              <span key={`${key}-${value}`} className="rounded-full bg-[var(--sh-faint)] px-3 py-1 text-xs font-semibold text-[var(--sh-ink)] ring-1 ring-black/10">
                {t(`research.intake.label.${key}`)}: {value}
              </span>
            ))}
            {draft.unknowns.map((key) => (
              <span key={key} className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                {t(`research.intake.missing.${key}`)}
              </span>
            ))}
          </div>
        )}
      </div>

      {currentQuestion ? (
        <div className="mt-4 rounded-2xl border border-black/10 bg-[var(--sh-canvas)] p-4">
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("research.intake.questionLabel")}</p>
          <h3 className="mt-2 text-lg font-semibold text-[var(--sh-ink)]">{currentQuestion.question}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--sh-muted)]">{currentQuestion.reason}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {currentQuestion.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onAnswer(currentQuestion, option)}
                className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--sh-ink)] transition hover:border-black/20 hover:bg-[var(--sh-faint)]"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitCustom();
              }}
              placeholder={t("research.intake.customPlaceholder")}
              className="min-h-11 flex-1 rounded-full border border-black/10 bg-white px-4 text-sm text-[var(--sh-ink)] outline-none transition placeholder:text-[var(--sh-muted)] focus:border-black/25"
            />
            <button type="button" onClick={submitCustom} className="sh-secondary-action px-4">
              {t("research.intake.submitCustom")}
            </button>
            <button type="button" onClick={() => onSkip(currentQuestion)} className="sh-secondary-action px-4">
              {t("research.intake.skip")}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-semibold text-emerald-950">{t("research.intake.confirmedTitle")}</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-800">{t("research.intake.confirmedDescription")}</p>
          </div>
          <button type="button" onClick={onRun} disabled={loading} className="sh-primary-action px-4">
            <FiPlay aria-hidden="true" />
            {t("research.intake.searchNow")}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-black/10 pt-4">
        <p className="text-xs leading-5 text-[var(--sh-muted)]">{t("research.intake.advancedHint")}</p>
        <button type="button" onClick={onOpenAdvanced} className="sh-secondary-action px-4">
          <FiSliders aria-hidden="true" />
          {t("research.intake.advancedPlan")}
        </button>
      </div>
    </Surface>
  );
}

function IntakeList({
  title,
  tone,
  items,
  fallback,
}: {
  title: string;
  tone: "emerald" | "blue" | "red";
  items: string[];
  fallback: string;
}) {
  const toneClass = {
    emerald: "border-emerald-100 bg-emerald-50/55 text-emerald-950",
    blue: "border-blue-100 bg-blue-50/55 text-blue-950",
    red: "border-red-100 bg-red-50/55 text-red-950",
  }[tone];
  return (
    <div className={`rounded-2xl border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-2 space-y-1.5 text-sm leading-6">
        {(items.length > 0 ? items : [fallback]).map((item, index) => (
          <li key={`${item}-${index}`} className={items.length > 0 ? "" : "opacity-60"}>{item}</li>
        ))}
      </ul>
    </div>
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
  const [contactIntentMessage, setContactIntentMessage] = useState("");
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
  const [searchIntakeDraft, setSearchIntakeDraft] = useState<SearchIntakeDraft | null>(null);
  const [advancedPlanOpen, setAdvancedPlanOpen] = useState(false);
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
    setCandidateDecisions({});
    setAdvancedDetailsOpen(false);
    if (!options.preserveInput) {
      setEditablePlan(null);
      setSearchIntakeDraft(null);
      setAdvancedPlanOpen(false);
    }
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

  async function uploadSearchBriefFile(file: File) {
    if (mode !== "search" || loading || resumeUploading) return;
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
      let text = "";
      let warning = "";
      let fileName = file.name;
      if (fileType === "pdf") {
        const data = await extractPdfTextFromFile(file);
        text = data.text;
        warning = data.truncated ? t("research.resumeUploadTruncated") : "";
      } else {
        const form = new FormData();
        form.set("file", file);
        form.set("locale", locale);
        const res = await fetch(`/api/verify/extract?locale=${locale}`, { method: "POST", body: form });
        const data: ResumeExtractResponse = await res.json().catch(() => ({}));
        if (!res.ok || !data.text?.trim()) {
          setResumeUploadError(data.error || t("api.error.resumeParseFailed"));
          return;
        }
        text = data.text;
        fileName = data.fileName || file.name;
        warning = data.warning || (data.truncated ? t("research.resumeUploadTruncated") : "");
      }
      if (!text.trim()) {
        setResumeUploadError(t("api.error.resumeEmptyText"));
        return;
      }
      setInput(text);
      createSearchIntake(text);
      setResumeUploadMessage(t("research.jdUploadSelected", { name: fileName }));
      setResumeUploadWarning(warning);
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

  function createSearchIntake(value: string) {
    const draft = buildSearchIntakeDraft(value, { locale }) as SearchIntakeDraft;
    setSearchIntakeDraft(draft);
    setEditablePlan(buildEditablePlanFromIntake(draft));
    setAdvancedPlanOpen(false);
  }

  function syncSearchIntake(nextDraft: SearchIntakeDraft) {
    setSearchIntakeDraft(nextDraft);
    setEditablePlan(buildEditablePlanFromIntake(nextDraft));
  }

  function buildEditablePlanFromIntake(draft: SearchIntakeDraft) {
    const base = buildEditableSearchPlanDraft(draft.original_query, { locale }) as EditableSearchPlanDraft;
    const clarification = draft.clarification ?? {};
    const constraints = [
      clarification.location ? `${t("research.intake.label.location")}: ${clarification.location}` : "",
      clarification.salary ? `${t("research.intake.label.salary")}: ${clarification.salary}` : "",
      clarification.target_count ? `${t("research.intake.label.target_count")}: ${clarification.target_count}` : "",
    ].filter(Boolean);
    const sourceConstraint = constraints.join("；");
    return {
      ...base,
      search_brief: {
        ...base.search_brief,
        original_query: buildIntakeSearchInput({ draft, locale }),
        geography: clarification.location ?? base.search_brief.geography,
        evidence_preferences: uniquePlanValues([
          ...(base.search_brief.evidence_preferences ?? []),
          clarification.salary ? `${t("research.intake.label.salary")}: ${clarification.salary}` : "",
          clarification.target_count ? `${t("research.intake.label.target_count")}: ${clarification.target_count}` : "",
        ]),
      },
      search_plan: {
        ...base.search_plan,
        source_strategy: base.search_plan.source_strategy.map((source: EditableSourceStrategy) => ({
          ...source,
          target: uniquePlanValues([source.target, clarification.location]).join(" · "),
          query: uniquePlanValues([source.query, clarification.location]).join(" "),
          reason: uniquePlanValues([source.reason, sourceConstraint]).join("；"),
        })),
      },
    };
  }

  function uniquePlanValues(items: Array<string | null | undefined>) {
    return Array.from(new Set(items.map((item) => String(item ?? "").trim()).filter(Boolean)));
  }

  function runSearchFlow() {
    if (!input.trim() && !searchIntakeDraft) return;
    if (searchIntakeDraft) {
      runSearchIntake();
      return;
    }
    createSearchIntake(input);
  }

  function updateResearchInput(value: string) {
    setInput(value);
    if (mode === "search" && searchIntakeDraft && value !== searchIntakeDraft.original_query) {
      setSearchIntakeDraft(null);
      setEditablePlan(null);
      setAdvancedPlanOpen(false);
    }
  }

  function answerIntakeQuestion(question: SearchIntakeQuestion, option: { value: string; label: string }) {
    if (!searchIntakeDraft) return;
    syncSearchIntake(answerSearchIntakeQuestion(searchIntakeDraft, {
      key: question.key,
      value: option.value,
      label: option.label,
    }) as SearchIntakeDraft);
  }

  function answerCustomIntakeQuestion(question: SearchIntakeQuestion, value: string) {
    if (!searchIntakeDraft || !value.trim()) return;
    syncSearchIntake(answerSearchIntakeQuestion(searchIntakeDraft, {
      key: question.key,
      value,
      label: value,
    }) as SearchIntakeDraft);
  }

  function skipIntakeQuestion(question: SearchIntakeQuestion) {
    if (!searchIntakeDraft) return;
    syncSearchIntake(answerSearchIntakeQuestion(searchIntakeDraft, {
      key: question.key,
      skipped: true,
    }) as SearchIntakeDraft);
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

  function runSearchIntake() {
    if (!searchIntakeDraft) return;
    run(buildIntakeSearchInput({ draft: searchIntakeDraft, locale }), { preserveInput: true });
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

  function requestCandidateEmail(index: number, candidate: TalentCandidate) {
    setSelectedCandidateIndex(index);
    setContactIntentMessage(locale === "en"
      ? `Contact enrichment entry reserved for ${candidate.name}. The next commercial release can connect credits, compliant source logging, and email enrichment here without inventing an address.`
      : `已为 ${candidate.name} 预留联系方式富集入口。下一版可在这里接入点数扣减、合规来源记录和邮箱富集，不会猜测或展示未验证邮箱。`);
  }

  const isSearch = mode === "search";
  const progressView = buildResearchLoopView({ feed, live, jobStatus, locale });
  const evidencePriorityView = isTalentSearchResult(result) ? buildEvidencePriorityView({ result, locale }) : null;
  const intakeQuestions = searchIntakeDraft ? buildSearchIntakeQuestions(searchIntakeDraft, { locale }) : [];
  const constraintEditor = isSearch && !loading && !result && !searchIntakeDraft
    ? buildSearchConstraintEditor({ input, locale })
    : null;
  const constraintEditorSplitIndex = constraintEditor
    ? Math.max(0, Math.ceil((constraintEditor.sections.length + 1) / 2) - 1)
    : 0;
  const constraintEditorLeftSections = constraintEditor
    ? constraintEditor.sections.slice(0, constraintEditorSplitIndex)
    : [];
  const constraintEditorRightSections = constraintEditor
    ? constraintEditor.sections.slice(constraintEditorSplitIndex)
    : [];
  const constraintEditorBaseRows = constraintEditor
    ? Math.max(3, Math.min(8, splitPlanText(constraintEditor.base.value).length + 1))
    : 3;
  const activeCandidateIndex = isTalentSearchResult(result) && result.candidates.length > 0
    ? Math.min(selectedCandidateIndex ?? 0, result.candidates.length - 1)
    : null;
  const searchRunStarted = isSearch && (loading || Boolean(result));
  const showSearchSetup = !isSearch || (!searchRunStarted && !searchIntakeDraft);
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

      {showSearchSetup ? (
        <ResearchInputStage
          mode={mode}
          input={input}
          onInputChange={updateResearchInput}
          onRun={isSearch ? runSearchFlow : () => run()}
          onCreatePlan={undefined}
          onJdUpload={mode === "search" ? uploadSearchBriefFile : undefined}
          loading={loading}
          onResumeUpload={mode === "verify" ? (file) => uploadVerificationFile(file, "resume") : undefined}
          onSupportingMaterialUpload={mode === "verify" ? (file) => uploadVerificationFile(file, "supportingMaterial") : undefined}
          activeUploadKind={mode === "search" ? "jd" : verifyUploadKind}
          resumeUploading={resumeUploading}
          resumeUploadMessage={resumeUploadMessage}
          resumeUploadWarning={resumeUploadWarning}
          resumeUploadError={resumeUploadError}
        />
      ) : null}

      {!searchRunStarted && constraintEditor && constraintEditor.sections.length > 0 && (
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
          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            <div className="space-y-4">
              <label className="block rounded-2xl bg-[var(--sh-canvas)] p-4 ring-1 ring-black/5">
                <span className="text-xs font-semibold text-[var(--sh-muted)]">{constraintEditor.base.label}</span>
                <textarea
                  value={constraintEditor.base.value}
                  onChange={(event) => updateConstraintEditorBase(constraintEditor, event.target.value)}
                  rows={constraintEditorBaseRows}
                  className="mt-2 block w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-3 text-sm leading-6 text-[var(--sh-ink)] outline-none transition focus:border-black/20"
                />
              </label>
              {constraintEditorLeftSections.map((section) => (
                <label key={section.key} className="block border-t border-black/10 pt-4">
                  <span className="text-xs font-semibold text-[var(--sh-muted)]">{section.label}</span>
                  <textarea
                    value={joinPlanText(section.items)}
                    onChange={(event) => updateConstraintEditorSection(constraintEditor, section.key, event.target.value)}
                    rows={Math.max(4, section.items.length + 1)}
                    className="mt-2 block w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-3 text-sm leading-6 text-[var(--sh-ink)] outline-none transition focus:border-black/20"
                  />
                </label>
              ))}
            </div>
            <div className="space-y-4">
              {constraintEditorRightSections.map((section) => (
                <label key={section.key} className="block border-t border-black/10 pt-4 first:border-t-0 first:pt-0">
                  <span className="text-xs font-semibold text-[var(--sh-muted)]">{section.label}</span>
                  <textarea
                    value={joinPlanText(section.items)}
                    onChange={(event) => updateConstraintEditorSection(constraintEditor, section.key, event.target.value)}
                    rows={Math.max(4, section.items.length + 1)}
                    className="mt-2 block w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-3 text-sm leading-6 text-[var(--sh-ink)] outline-none transition focus:border-black/20"
                  />
                </label>
              ))}
            </div>
          </div>
        </Surface>
      )}

      {!searchRunStarted && isSearch && searchIntakeDraft && !result && (
        <SearchIntakePanel
          draft={searchIntakeDraft}
          questions={intakeQuestions}
          loading={loading}
          onAnswer={answerIntakeQuestion}
          onCustomAnswer={answerCustomIntakeQuestion}
          onSkip={skipIntakeQuestion}
          onRun={runSearchIntake}
          onOpenAdvanced={() => setAdvancedPlanOpen((open) => !open)}
        />
      )}

      {!searchRunStarted && isSearch && editablePlan && !result && (
        <details
          open={advancedPlanOpen}
          onToggle={(event) => setAdvancedPlanOpen(event.currentTarget.open)}
          className="group"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white/82 px-5 py-4 text-sm font-semibold text-[var(--sh-ink)] shadow-sm transition hover:border-black/20">
            <span className="inline-flex items-center gap-2">
              <FiSliders aria-hidden="true" />
              {t("research.intake.advancedPlan")}
            </span>
            <FiChevronDown className="transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="mt-3">
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
          </div>
        </details>
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
                  <SearchResultWorkspaceView
                    result={result}
                    stats={stats}
                    selectedIndex={selectedCandidateIndex}
                    shortlist={shortlist}
                    decisions={candidateDecisions}
                    loading={loading}
                    commercialNotice={contactIntentMessage}
                    onOpenCandidate={openCandidateForReview}
                    onAddToPool={addCandidateToPool}
                    onNeedEvidence={needEvidenceForCandidate}
                    onPass={passCandidate}
                    onOutreach={() => setOutreachOpen(true)}
                    onGetEmail={requestCandidateEmail}
                    onShowProcess={() => setAdvancedDetailsOpen(true)}
                    locale={locale}
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
      {isTalentSearchResult(result) && activeCandidateIndex !== null && (
        <OutreachModal
          open={outreachOpen}
          onClose={() => setOutreachOpen(false)}
          candidate={result.candidates[activeCandidateIndex]}
          candidateName={result.candidates[activeCandidateIndex]?.name}
          roleBrief={result.search_brief.original_query}
        />
      )}
    </div>
  );
}
