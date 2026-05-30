"use client";

// ResearchTool —— 搜人/核验通用工具组件。
// Phase 1.1: 把原 page.tsx 的搜索/验证/轮询逻辑抽出来, 由 mode prop 锁定模式。
// 搜索 → TalentMap + ShortlistCard 列表
// 核验 → TrustReportView
import { useEffect, useRef, useState } from "react";
import {
  CandidateCard,
  CandidateProfileView,
  ShortlistCard,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import type { TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";

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
  phase: "queued" | "running" | "retrying" | "done" | "error";
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

const WORKER_DELAY_MS = 2 * 60 * 1000;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;

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
}: {
  mode: "search" | "verify";
  initialInput?: string;
  autoRun?: boolean; // 进页面就自动跑 (用于历史回放 / hero 提交带 query 过来)
}) {
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AppResult | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<number[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [live, setLive] = useState<{ searches: number; fetches: number } | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusView | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const idRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => stopPolling, []);

  function beginPolling(jobId: string) {
    stopPolling();
    const startedAt = Date.now();
    let pollFailures = 0;
    pollRef.current = setInterval(async () => {
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
          setResult(j.result);
          setStats(p ? { searches: p.searches ?? 0, fetches: p.fetches ?? 0 } : null);
          setRunId(j.runId ?? jobId);
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

  async function run(override?: string) {
    const value = (override ?? input).trim();
    if (!value) return;
    if (override !== undefined) setInput(value);
    stopPolling();
    setLoading(true); setError(""); setResult(null); setStats(null);
    setSelectedCandidateIndex(null); setShortlist([]);
    setFeed([]); setLive(null); setRunId(null); setCurrentJobId(null);
    setJobStatus(null); setCopied(false);
    try {
      const url = mode === "search" ? "/api/search" : "/api/verify";
      const body = mode === "search" ? { query: value } : { bio: value };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") || "";

      if (ct.includes("ndjson") && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value: chunk } = await reader.read();
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
            } else if (ev.type === "error") {
              setError(ev.error || "出错了");
            }
          }
        }
        setLoading(false);
      } else {
        const j: QueueResponse = await res.json().catch(() => ({}));
        if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); setLoading(false); return; }
        if (j.queued && j.jobId) {
          setCurrentJobId(j.jobId);
          setJobStatus({ phase: "queued", label: "已进入研究队列", detail: "等待 worker 认领任务。", canRetry: false });
          beginPolling(j.jobId);
        } else {
          setError(j.error ?? "出错了"); setLoading(false);
        }
      }
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
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

  // 进页面就自动跑 (hero 跳过来 / 历史回放)
  const ranAuto = useRef(false);
  useEffect(() => {
    if (autoRun && initialInput && !ranAuto.current) {
      ranAuto.current = true;
      run(initialInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, initialInput]);

  const isSearch = mode === "search";

  return (
    <div className="space-y-5">
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
        </div>
      </div>

      {/* 进度区 */}
      {loading && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {jobStatus?.label ?? "MiroMind 正在全网搜索 + 交叉核对…"}
            {live && (
              <span className="text-gray-500">（搜索 {live.searches} 次 · 抓取 {live.fetches} 次）</span>
            )}
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
              <TalentMapView result={result} />
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
                        onToggle={() => {
                          setShortlist((items) =>
                            items.includes(i) ? items.filter((item) => item !== i) : [...items, i],
                          );
                        }}
                      />
                    ))}
                  </div>
                  <div className="lg:sticky lg:top-6 lg:self-start">
                    {selectedCandidateIndex === null ? (
                      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
                        点击候选人的「查看详情」打开证据画像。
                      </div>
                    ) : (
                      <CandidateProfileView candidate={result.candidates[selectedCandidateIndex]} />
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
    </div>
  );
}
