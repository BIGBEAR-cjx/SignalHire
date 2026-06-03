"use client";

// ResearchTool —— 搜人/核验通用工具组件。
// Phase 1.1: 把原 page.tsx 的搜索/验证/轮询逻辑抽出来, 由 mode prop 锁定模式。
// 搜索 → TalentMap + ShortlistCard 列表
// 核验 → TrustReportView
import { useEffect, useRef, useState } from "react";
import {
  BackfillMergeSummaryView,
  CandidateCard,
  CandidateComparisonView,
  CandidateProfileView,
  CoverageBackfillView,
  EvidenceCoverageView,
  EvidenceGraphView,
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
import { buildBackfillMergeSummary, buildEditableSearchPlanDraft, buildFeedbackOptimizedSearchInput, buildSearchInputFromEditablePlan } from "@/lib/talent-profile.mjs";
import type { BackfillMergeSummary, CoverageBackfillJob, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";

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
type SearchFeedbackOption = { value: SearchFeedbackState[SearchFeedbackField]; label: string };
type SearchFeedbackGroup = { key: SearchFeedbackField; label: string; options: SearchFeedbackOption[] };

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
    label: "候选人是否精准？",
    options: [
      { value: "accurate", label: "精准" },
      { value: "partial", label: "部分精准" },
      { value: "off", label: "不精准" },
    ],
  },
  {
    key: "satisfaction",
    label: "推荐人选是否满意？",
    options: [
      { value: "satisfied", label: "满意" },
      { value: "mixed", label: "一般" },
      { value: "unsatisfied", label: "不满意" },
    ],
  },
  {
    key: "issue",
    label: "主要问题",
    options: [
      { value: "too_broad", label: "太泛" },
      { value: "wrong_seniority", label: "资历不对" },
      { value: "wrong_direction", label: "方向不对" },
      { value: "weak_evidence", label: "证据不足" },
      { value: "wrong_location", label: "地域不对" },
      { value: "too_few", label: "太少" },
      { value: "too_many", label: "太多" },
    ],
  },
  {
    key: "focus",
    label: "下一轮优化方向",
    options: [
      { value: "stricter_match", label: "更严格" },
      { value: "expand_sources", label: "扩来源" },
      { value: "stronger_evidence", label: "强证据" },
      { value: "adjacent_pools", label: "换人才池" },
      { value: "higher_seniority", label: "更资深" },
      { value: "location_fit", label: "调地域" },
    ],
  },
];

function isVerifyReport(result: AppResult): result is VerifyReport {
  return "claims" in result;
}
function isTalentSearchResult(result: AppResult | null): result is TalentSearchResult {
  return Boolean(result && "talent_map" in result && "search_brief" in result && Array.isArray((result as TalentSearchResult).candidates));
}

function userFacingStatus(view: JobStatusView, elapsedMs: number): JobStatusView {
  if (view.phase === "queued" && elapsedMs > WORKER_DELAY_MS) {
    return {
      ...view,
      label: "研究服务暂时繁忙",
      detail: "任务还在队列中，worker 可能正在处理上一条或暂时离线。页面会继续自动等待，完成后也会进入搜索历史。",
    };
  }
  if (view.phase === "retrying" && elapsedMs > WORKER_DELAY_MS) {
    return {
      ...view,
      detail: `${view.detail} 页面会继续自动等待；如果最终失败，会提供重新研究按钮。`,
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
        setError("研究服务暂时繁忙或 worker 离线较久。任务仍保留在后台，完成后会出现在历史里，也可以稍后重新研究。");
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`/api/status?id=${jobId}`);
        const j: StatusResponse = await r.json();
        if (token !== runTokenRef.current) return;
        pollFailures = 0;
        if (j.status_view) setJobStatus(userFacingStatus(j.status_view, elapsedMs));
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
            label: "正在重新连接状态服务",
            detail: "状态查询连接不稳定，研究任务仍在后台继续。页面会自动重试。",
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
      const body: Record<string, unknown> = mode === "search" ? { query: value } : { bio: value };
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
          setJobStatus({ phase: "queued", label: "已进入研究队列", detail: "等待 worker 认领任务。", canRetry: false });
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
    run(buildFeedbackOptimizedSearchInput({ result, feedback: searchFeedback }), { preserveInput: true });
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
      label: "搜索已停止",
      detail: "你已停止本次搜索。可以调整条件后重新搜索。",
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
    setJobStatus({ phase: "queued", label: "已重新入队", detail: "等待 worker 重新认领任务。", canRetry: false });
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
    setJobStatus({ phase: "queued", label: "补搜已进入研究队列", detail: "等待 worker 认领这个证据缺口任务。", canRetry: false });
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
  const hasCoreSearchFeedback = Boolean(searchFeedback.precision && searchFeedback.satisfaction);

  return (
    <div className="space-y-5">
      {/* 项目上下文面包屑 (在某项目下搜/验时显示) */}
      {projectId && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm">
          <span className="text-base">📁</span>
          <span className="text-emerald-800">
            在项目 <span className="font-semibold">{projectName ?? "(本项目)"}</span> 下{isSearch ? "搜人" : "核验"}
            <span className="text-emerald-600/80"> — 结果和收藏会自动归到此项目</span>
          </span>
          <span className="flex-1" />
          <a href={`/app/projects/${projectId}`} className="text-xs text-emerald-700 underline-offset-2 hover:underline">← 回项目</a>
        </div>
      )}

      {/* 输入区 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
              {isSearch ? "Search Brief" : "Candidate Bio"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {isSearch ? "全球 AI 人才搜索" : "候选人深度核验"}
            </h2>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
            isSearch
              ? "bg-blue-50 text-blue-700 ring-blue-100"
              : "bg-amber-50 text-amber-800 ring-amber-100"
          }`}>
            {isSearch ? "10-15 人 shortlist" : "跨源核验报告"}
          </span>
        </div>

        <div className="mt-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={isSearch ? 5 : 7}
            placeholder={
              isSearch
                ? "例如：找做过 LLM inference / serving、熟悉 vLLM 或 Triton、能做 AI infra 落地的 senior engineer，北美或欧洲优先，可远程"
                : "粘贴候选人的自述 / 简历 / LinkedIn 介绍。我们会对每条声称做跨源核实，给出 verified / contradicted / unverified 报告。"
            }
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
          <button
            type="button"
            onClick={() => run()}
            disabled={loading || !input.trim()}
            className="mt-4 w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto"
          >
            {loading
              ? isSearch ? "正在搜索全球 AI 候选人…" : "正在跨源核验…"
              : isSearch ? "生成 AI 人才 shortlist" : "核验候选人"}
          </button>
          {isSearch && (
            <button
              type="button"
              onClick={createEditablePlan}
              disabled={loading || !input.trim()}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-5 py-3 font-medium text-gray-700 transition hover:border-gray-900 disabled:opacity-50 sm:ml-3 sm:mt-4 sm:w-auto"
            >
              生成搜索计划
            </button>
          )}
        </div>

        {isSearch && editablePlan && (
          <div className="mt-5 border-t border-gray-100 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">搜索计划</h3>
              <button
                type="button"
                onClick={runEditablePlan}
                disabled={loading}
                className="rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                按计划搜索
              </button>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-emerald-700">必须条件</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.must_have)}
                  onChange={(e) => updateEditablePlanList("must_have", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-emerald-100 bg-emerald-50/40 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-blue-700">加分条件</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.nice_to_have)}
                  onChange={(e) => updateEditablePlanList("nice_to_have", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:bg-white"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-red-700">排除条件</span>
                <textarea
                  value={joinPlanText(editablePlan.search_plan.exclusions)}
                  onChange={(e) => updateEditablePlanList("exclusions", e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-red-100 bg-red-50/40 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-red-500 focus:bg-white"
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
          </div>
        )}
      </div>

      {/* 进度区 */}
      {loading && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
              {jobStatus?.label ?? "MiroMind 正在全网搜索 + 交叉核对…"}
              {live && (
                <span className="text-gray-500">（搜索 {live.searches} 次 · 抓取 {live.fetches} 次）</span>
              )}
            </div>
            <button
              type="button"
              onClick={stopCurrentRun}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:border-gray-900"
            >
              停止搜索
            </button>
          </div>
          {jobStatus?.detail && (
            <p className="mt-2 text-xs text-gray-500">{jobStatus.detail}</p>
          )}
          {feed.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">深度研究通常需要几分钟，进度会实时显示、完成后自动出结果。</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto font-mono text-xs">
              {feed.slice().reverse().map((s) => (
                <li key={s.id} className="flex gap-2 text-gray-600">
                  <span>{s.kind === "search" ? "🔍" : "📄"}</span>
                  <span className="truncate" title={s.info}>
                    {s.info || (s.kind === "search" ? "(搜索中)" : "(抓取中)")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!loading && jobStatus?.phase === "canceled" && (
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
          <p>{jobStatus.detail}</p>
        </div>
      )}

      {/* 错误区 */}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <p>出错: {error}</p>
          {jobStatus?.canRetry && currentJobId && (
            <button
              onClick={retryCurrentJob}
              className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
            >
              重新研究
            </button>
          )}
        </div>
      )}

      {/* 结果区 */}
      {result && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            {stats ? (
              <p className="flex items-center gap-2 text-xs text-gray-500">
                {stats.cached ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-200">
                    预缓存 · 秒出
                  </span>
                ) : (
                  <span>本次研究: 网页搜索 {stats.searches} 次 · 抓取 {stats.fetches} 次</span>
                )}
              </p>
            ) : <span />}
            {runId && (
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(`${location.origin}/r/${runId}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-900"
              >
                {copied ? "✓ 链接已复制" : "🔗 分享报告"}
              </button>
            )}
          </div>
          {isTalentSearchResult(result) ? (
            <>
              {backfillMergeSummary && (
                <BackfillMergeSummaryView
                  summary={backfillMergeSummary}
                  onMerge={backfillContext?.originalRunId && runId ? mergeBackfillIntoOriginal : undefined}
                  mergeDisabled={mergingBackfill}
                  merged={Boolean(mergedOriginalRunId)}
                />
              )}
              <SearchPlanView result={result} />
              <ShortlistDeliveryReportView result={result} />
              <SourceExecutionView result={result} />
              <CoverageBackfillView result={result} onBackfillJob={enqueueBackfillJob} backfillDisabled={loading} />
              <EvidenceCoverageView result={result} />
              <TalentMapView result={result} />
              <CandidateComparisonView result={result} />
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">这轮结果怎么样？</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      用选择题反馈本轮 shortlist，下一轮会按你的反馈调整搜索和交叉验证重点。
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={runFeedbackOptimizedSearch}
                    disabled={loading || !hasCoreSearchFeedback}
                    className="rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    按反馈优化下一轮
                  </button>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {SEARCH_FEEDBACK_GROUPS.map((group) => (
                    <div key={group.key}>
                      <p className="text-xs font-semibold text-gray-500">{group.label}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {group.options.map((option) => {
                          const selected = searchFeedback[group.key] === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => updateSearchFeedback(group.key, option.value)}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                                selected
                                  ? "border-gray-900 bg-gray-900 text-white"
                                  : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-900 hover:bg-white"
                              }`}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {!hasCoreSearchFeedback && (
                  <p className="mt-4 text-xs text-gray-400">先选择精准度和满意度后即可重跑；主要问题和优化方向可选。</p>
                )}
              </section>
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Shortlist</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      已选 {shortlist.length} / {result.candidates.length} 人
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
                      />
                    ))}
                  </div>
                  <div className="lg:sticky lg:top-6 lg:self-start space-y-3">
                    {selectedCandidateIndex === null ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
                        点击候选人的「查看详情」打开证据画像。
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setOutreachOpen(true)}
                          className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-700"
                        >
                          ✉️ AI 起草外联邮件给 {result.candidates[selectedCandidateIndex]?.name?.split(" ")[0]}
                        </button>
                        <EvidenceGraphView result={result} candidate={result.candidates[selectedCandidateIndex]} />
                        <CandidateProfileView candidate={result.candidates[selectedCandidateIndex]} result={result} />
                      </>
                    )}
                  </div>
                </div>
              </section>
            </>
          ) : isVerifyReport(result) ? (
            <TrustReportView r={result} />
          ) : (
            (result.candidates ?? []).map((c: Candidate, i: number) => <CandidateCard key={i} c={c} delay={i * 90} />)
          )}
        </div>
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
