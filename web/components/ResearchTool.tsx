"use client";

// ResearchTool —— 搜人/核验通用工具组件。
// Phase 1.1: 把原 page.tsx 的搜索/验证/轮询逻辑抽出来, 由 mode prop 锁定模式。
// 搜索 → TalentMap + ShortlistCard 列表
// 核验 → TrustReportView
import { useEffect, useRef, useState } from "react";
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
  ResearchErrorPanel,
  ResearchInputStage,
  ResearchProcessPanel,
  ResearchResultShell,
  ResearchShareBar,
} from "@/components/research-workspace";
import { buildBackfillMergeSummary, buildEditableSearchPlanDraft, buildFeedbackOptimizedSearchInput, buildSearchInputFromEditablePlan } from "@/lib/talent-profile.mjs";
import type { BackfillMergeSummary, CoverageBackfillJob, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
import { buildFeedbackOptimizationPreview, buildResearchLoopView } from "@/lib/research-loop.mjs";
import { buildEvidencePriorityView } from "@/lib/evidence-priority.mjs";

type FeedItem = { id: number; kind: "search" | "fetch"; info: string };
type SearchResult = { candidates?: Candidate[] } | TalentSearchResult;
type AppResult = SearchResult | VerifyReport;
type RunStats = { searches: number; fetches: number; cached?: boolean };
type ResearchStepEvent = { type: "step"; kind: "search" | "fetch"; info: string; searches: number; fetches: number };
type ResearchDoneEvent = { type: "done"; data: AppResult; stats?: RunStats | null; runId?: string | null };
type ResearchErrorEvent = { type: "error"; error?: string };
type ResearchEvent = ResearchStepEvent | ResearchDoneEvent | ResearchErrorEvent;
type QueueResponse = { queued?: boolean; jobId?: string; error?: string };
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
type MergeBackfillResponse = { merged?: boolean; runId?: string; result?: AppResult; mergeSummary?: BackfillMergeSummary; error?: string };
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
}: {
  mode: "search" | "verify";
  initialInput?: string;
  autoRun?: boolean; // 进页面就自动跑 (用于历史回放 / hero 提交带 query 过来)
  projectId?: string;
  projectName?: string;
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
  const idRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runTokenRef = useRef(0);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => stopPolling, []);

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
        const r = await fetch(`/api/status?id=${jobId}`);
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
          if (!j.result) { setError("研究完成但结果为空，请重新研究"); setLoading(false); return; }
          const mergeContext = context ?? backfillContext;
          if (mergeContext && isTalentSearchResult(j.result)) {
            setBackfillMergeSummary(buildBackfillMergeSummary({
              originalResult: mergeContext.originalResult,
              backfillResult: j.result,
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
          setError(j.error || "研究失败，请重试");
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
              setError(ev.error || "出错了");
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
          setError(j.error ?? "出错了"); setLoading(false);
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

  function splitPlanText(value: string) {
    return value.split("\n").map((item) => item.trim()).filter(Boolean);
  }

  function joinPlanText(items: string[]) {
    return items.join("\n");
  }

  function createEditablePlan() {
    if (!input.trim()) return;
    setEditablePlan(buildEditableSearchPlanDraft(input));
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
    run(buildSearchInputFromEditablePlan({ draft: editablePlan }), { preserveInput: true });
  }

  function updateSearchFeedback(key: SearchFeedbackField, value: SearchFeedbackState[SearchFeedbackField]) {
    setSearchFeedback((current) => ({
      ...current,
      [key]: current[key] === value ? "" : value,
    }));
  }

  function runFeedbackOptimizedSearch() {
    if (!isTalentSearchResult(result)) return;
    const optimizedInput = buildFeedbackOptimizedSearchInput({ result, feedback: searchFeedback });
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
        body: JSON.stringify({ id: jobId }),
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
        body: JSON.stringify({ id: currentJobId }),
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
        setError(j.error ?? "补搜入队失败"); setLoading(false);
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
    fetch(`/api/shortlist?run=${encodeURIComponent(runId)}`)
      .then((r) => r.ok ? r.json() : { indices: [] })
      .then((j) => { if (!cancelled) setShortlist(Array.isArray(j.indices) ? j.indices : []); })
      .catch(() => { if (!cancelled) setShortlist([]); });
    return () => { cancelled = true; };
  }, [mode, runId]);

  // 收藏 toggle: 调 API 持久化 + 乐观更新; 失败回滚。
  async function toggleShortlist(idx: number, candidate: unknown) {
    if (savingIdx.has(idx)) return;
    const wasSaved = shortlist.includes(idx);
    // 乐观更新
    setShortlist((items) => wasSaved ? items.filter((i) => i !== idx) : [...items, idx]);
    setSavingIdx((s) => { const n = new Set(s); n.add(idx); return n; });
    try {
      if (wasSaved) {
        const r = await fetch(`/api/shortlist?run=${encodeURIComponent(runId ?? "")}&idx=${idx}`, { method: "DELETE" });
        if (!r.ok) throw new Error("delete failed");
      } else {
        const r = await fetch("/api/shortlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_run_id: runId,
            candidate_index: idx,
            candidate,
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

  const isSearch = mode === "search";
  const progressView = buildResearchLoopView({ feed, live, jobStatus, locale });
  const feedbackPreview = buildFeedbackOptimizationPreview({ feedback: searchFeedback, locale });
  const evidencePriorityView = isTalentSearchResult(result) ? buildEvidencePriorityView({ result, locale }) : null;
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

      <ResearchInputStage
        mode={mode}
        input={input}
        onInputChange={setInput}
        onRun={() => run()}
        onCreatePlan={isSearch ? createEditablePlan : undefined}
        loading={loading}
      />

      {isSearch && editablePlan && (
        <EditableSearchPlanPanel onRunPlan={runEditablePlan} loading={loading}>
          <div className="grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-emerald-700">必须条件</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.must_have)}
                  onChange={(e) => updateEditablePlanList("must_have", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-950 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-blue-700">加分条件</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.nice_to_have)}
                  onChange={(e) => updateEditablePlanList("nice_to_have", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm text-blue-950 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-red-700">排除条件</span>
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
          statsText={progressView.statsText}
          coverage={progressView.coverage}
          recentItems={progressView.recentItems}
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
                      setSelectedCandidateIndex(item.candidate_index);
                    }
                  }}
                  locale={locale}
                />
              )}
              <FeedbackOptimizationPreview
                groups={feedbackGroups}
                preview={feedbackPreview}
                loading={loading}
                onSelect={(key, value) => updateSearchFeedback(key as SearchFeedbackField, value as SearchFeedbackState[SearchFeedbackField])}
                onRun={runFeedbackOptimizedSearch}
              />
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{t("result.shortlistTitle")}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {t("result.selectedCount", { selected: shortlist.length, total: result.candidates.length })}
                    </p>
                  </div>
                  {result.search_brief.target_directions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {result.search_brief.target_directions.map((direction) => (
                        <span key={direction} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                          {direction}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
                  <div className="space-y-4">
                    {result.candidates.map((candidate: TalentCandidate, i: number) => (
                      <ShortlistCard
                        key={`${candidate.name}-${i}`}
                        candidate={candidate}
                        selected={shortlist.includes(i)}
                        onOpen={() => setSelectedCandidateIndex(i)}
                        onToggle={() => toggleShortlist(i, candidate)}
                        locale={locale}
                      />
                    ))}
                  </div>
                  <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
                    {selectedCandidateIndex === null ? (
                      <div className="rounded-3xl border border-dashed border-black/10 bg-white/80 p-5 text-sm text-[var(--sh-muted)]">
                        {t("result.openHint")}
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setOutreachOpen(true)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sh-ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
                        >
                          <FiMail className="h-4 w-4" aria-hidden="true" />
                          {t("result.outreachTo", { name: result.candidates[selectedCandidateIndex]?.name?.split(" ")[0] ?? "" })}
                        </button>
                        <EvidenceGraphView result={result} candidate={result.candidates[selectedCandidateIndex]} locale={locale} />
                        <CandidateProfileView candidate={result.candidates[selectedCandidateIndex]} result={result} locale={locale} />
                      </>
                    )}
                  </div>
                </div>
              </section>
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
