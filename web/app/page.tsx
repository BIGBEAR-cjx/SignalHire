"use client";

import { useEffect, useRef, useState } from "react";
import Landing from "./Landing";
import AuthModal from "@/components/AuthModal";
import { currentUser, logout } from "@/lib/auth";
import { HERO_BIO } from "@/lib/cache";
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
type HistoryItem = {
  kind: "search" | "verify";
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
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

// ---- 主页面 ----
export default function Home() {
  const [mode, setMode] = useState<"search" | "verify">("search");
  const [query, setQuery] = useState("找做过 LLM inference / serving、熟悉 vLLM 或 Triton、能做 AI infra 落地的 senior engineer，北美或欧洲优先，可远程");
  const [bio, setBio] = useState(HERO_BIO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AppResult | null>(null);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number | null>(null);
  const [shortlist, setShortlist] = useState<number[]>([]);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]); // 实时研究流: 它在搜什么/抓什么
  const [live, setLive] = useState<{ searches: number; fetches: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [runId, setRunId] = useState<string | null>(null); // 可分享报告 id
  const [jobStatus, setJobStatus] = useState<JobStatusView | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<{ email: string } | null>(null); // 登录态
  const [authOpen, setAuthOpen] = useState(false); // 登录弹窗
  const pendingRef = useRef<{ override?: string; forceMode?: "search" | "verify" } | null>(null); // 登录后续跑
  const idRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { currentUser().then(setUser); }, []);

  // 登录成功 → 关弹窗 + 续跑挂起的搜索/验证
  function handleAuthed(u: { email: string }) {
    setUser(u);
    setAuthOpen(false);
    const p = pendingRef.current;
    pendingRef.current = null;
    if (p) run(p.override, p.forceMode, true);
  }

  async function handleLogout() {
    await logout();
    setUser(null);
  }

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => stopPolling, []); // 卸载时清理轮询

  // 异步任务: 每 2s 轮询 /api/status, 用 progress 喂实时 feed, 完成/失败时收尾。
  function beginPolling(jobId: string) {
    stopPolling();
    const startedAt = Date.now();
    let pollFailures = 0;
    pollRef.current = setInterval(async () => {
      // 兜底: 转太久(worker 未上线/卡住)就停, 友好提示去历史看, 不无限转圈。
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > JOB_TIMEOUT_MS) {
        stopPolling();
        setError("研究服务暂时繁忙或 worker 离线较久。任务仍保留在后台，完成后会出现在下方「搜索历史」，也可以稍后重新研究。");
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
          setFeed((p.recent ?? []).map((x: { kind: "search" | "fetch"; info: string }, i: number) => ({ id: i, kind: x.kind, info: x.info })));
        }
        if (j.status === "done") {
          stopPolling();
          if (!j.result) {
            setError("研究完成但结果为空，请重新研究");
            setLoading(false);
            return;
          }
          setResult(j.result);
          setStats(p ? { searches: p.searches ?? 0, fetches: p.fetches ?? 0 } : null);
          setRunId(j.runId ?? jobId);
          setLoading(false);
          loadHistory();
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

  async function loadHistory() {
    try {
      const r = await fetch("/api/history");
      const j = await r.json();
      setHistory(j.runs ?? []);
    } catch {
      // 历史拉取失败不影响主流程
    }
  }
  useEffect(() => { loadHistory(); }, []);

  // override: 点示例芯片/历史时传入 —— 搜人模式当作 query, 验证模式当作 bio。
  // forceMode: 点历史记录时强制切到该条所属模式 (search/verify)。
  async function run(override?: string, forceMode?: "search" | "verify", bypassAuth = false) {
    // 未登录 → 暂存这次动作, 弹出登录, 登录成功后自动续跑
    if (!bypassAuth && !user) {
      pendingRef.current = { override, forceMode };
      setAuthOpen(true);
      return;
    }
    const m = forceMode ?? mode;
    if (forceMode && forceMode !== mode) setMode(forceMode);
    const q = m === "search" ? (override ?? query) : query;
    const b = m === "verify" ? (override ?? bio) : bio;
    if (override !== undefined) {
      if (m === "search") setQuery(override);
      else setBio(override);
    }
    stopPolling();
    setLoading(true); setError(""); setResult(null); setStats(null); setSelectedCandidateIndex(null); setShortlist([]);
    setFeed([]); setLive(null); setRunId(null); setCurrentJobId(null); setJobStatus(null); setCopied(false);
    try {
      const url = m === "search" ? "/api/search" : "/api/verify";
      const body = m === "search" ? { query: q } : { bio: b };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const ct = res.headers.get("content-type") || "";

      if (ct.includes("ndjson") && res.body) {
        // 缓存命中: 读 NDJSON 流 (通常单个 done 事件)
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
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
        loadHistory();
      } else {
        // JSON: 要么入队成功(转轮询), 要么错误
        const j: QueueResponse = await res.json().catch(() => ({}));
        if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); setLoading(false); return; }
        if (j.queued && j.jobId) {
          setCurrentJobId(j.jobId);
          setJobStatus({ phase: "queued", label: "已进入研究队列", detail: "等待 worker 认领任务。", canRetry: false });
          beginPolling(j.jobId); // loading 保持 true, 轮询完成/失败时再关闭
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
    setLoading(true);
    setError("");
    setResult(null);
    setFeed([]);
    setLive(null);
    setJobStatus({ phase: "queued", label: "已重新入队", detail: "等待 worker 重新认领任务。", canRetry: false });
    try {
      const res = await fetch("/api/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentJobId }),
      });
      const j: StatusResponse & { retried?: boolean } = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || `HTTP ${res.status}`);
        setLoading(false);
        return;
      }
      if (j.status_view) setJobStatus(j.status_view);
      beginPolling(currentJobId);
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
    }
  }

  return (
    <>
      <Landing
        user={user}
        onLoginClick={() => setAuthOpen(true)}
        onLogout={handleLogout}
        onSearch={(query) => {
          run(query, "search");
          document.getElementById("tool")?.scrollIntoView({ behavior: "smooth" });
        }}
        onDemo={() => {
          run(HERO_BIO, "verify");
          document.getElementById("tool")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <AuthModal
        open={authOpen}
        onClose={() => { pendingRef.current = null; setAuthOpen(false); }}
        onAuthed={handleAuthed}
      />
      <main id="tool" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-16 pt-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Search Brief</p>
          <h2 className="mt-1 text-lg font-semibold text-gray-900">全球 AI 人才搜索</h2>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          10-15 人 shortlist
        </span>
      </div>

      <div className="mt-4">
        <textarea
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setMode("search");
          }}
          rows={5}
          placeholder="例如：找做过 LLM inference / serving、熟悉 vLLM 或 Triton、能做 AI infra 落地的 senior engineer，北美或欧洲优先，可远程"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
        />

        <button
          type="button"
          onClick={() => run(undefined, "search")}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto"
        >
          {loading ? "正在搜索全球 AI 候选人…" : "生成 AI 人才 shortlist"}
        </button>
      </div>
      </div>

      {loading && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {jobStatus?.label ?? "MiroMind 正在全网搜索 + 交叉核对…"}
            {live && (
              <span className="text-gray-500">
                （搜索 {live.searches} 次 · 抓取 {live.fetches} 次）
              </span>
            )}
          </div>
          {jobStatus?.detail && (
            <p className="mt-2 text-xs text-gray-500">{jobStatus.detail}</p>
          )}
          {feed.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">深度研究通常需要几分钟，进度会实时显示、完成后自动出结果。</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-1 overflow-auto font-mono text-xs">
              {feed
                .slice()
                .reverse()
                .map((s) => (
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
      {error && (
        <div className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
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

      {result && (
        <div className="mt-6 space-y-4">
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

      {history.length > 0 && (
        <section className="mt-10 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700">搜索项目历史</h2>
          <p className="mt-0.5 text-xs text-gray-400">点击任意一条重新打开已完成的 shortlist 或证据报告</p>
          <ul className="mt-3 space-y-2">
            {history.map((h, i) => (
              <li key={i}>
                <button
                  onClick={() => run(h.query_text, h.kind)}
                  disabled={loading}
                  className="flex w-full items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-blue-400 disabled:opacity-50"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        h.kind === "verify"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {h.kind === "verify" ? "验证" : "搜人"}
                    </span>
                    <span className="min-w-0 truncate text-sm text-gray-800" title={h.query_text}>
                      {h.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{h.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      </main>
    </>
  );
}
