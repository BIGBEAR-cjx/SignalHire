"use client";

import { useEffect, useRef, useState } from "react";
import Landing from "./Landing";
import { SEARCH_SAMPLES, VERIFY_SAMPLES, HERO_BIO } from "@/lib/cache";
import { CandidateCard, TrustReportView, type Candidate } from "@/components/result";

type FeedItem = { id: number; kind: "search" | "fetch"; info: string };
type HistoryItem = {
  kind: "search" | "verify";
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
};

// ---- 主页面 ----
export default function Home() {
  const [mode, setMode] = useState<"search" | "verify">("verify");
  const [query, setQuery] = useState("Senior Rust engineer who has contributed to the Tokio project");
  const [bio, setBio] = useState(HERO_BIO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<{ searches: number; fetches: number; cached?: boolean } | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]); // 实时研究流: 它在搜什么/抓什么
  const [live, setLive] = useState<{ searches: number; fetches: number } | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [runId, setRunId] = useState<string | null>(null); // 可分享报告 id
  const [copied, setCopied] = useState(false);
  const idRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }
  useEffect(() => stopPolling, []); // 卸载时清理轮询

  // 异步任务: 每 2s 轮询 /api/status, 用 progress 喂实时 feed, 完成/失败时收尾。
  function beginPolling(jobId: string) {
    stopPolling();
    const startedAt = Date.now();
    pollRef.current = setInterval(async () => {
      // 兜底: 转太久(worker 未上线/卡住)就停, 友好提示去历史看, 不无限转圈。
      if (Date.now() - startedAt > 15 * 60 * 1000) {
        stopPolling();
        setError("研究排队/运行时间较长。完成后会出现在下方「搜索历史」，可稍后回来查看。");
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`/api/status?id=${jobId}`);
        const j = await r.json();
        const p = j.progress;
        if (p) {
          setLive({ searches: p.searches ?? 0, fetches: p.fetches ?? 0 });
          setFeed((p.recent ?? []).map((x: { kind: "search" | "fetch"; info: string }, i: number) => ({ id: i, kind: x.kind, info: x.info })));
        }
        if (j.status === "done") {
          stopPolling();
          setResult(j.result);
          setStats(p ? { searches: p.searches, fetches: p.fetches } : null);
          setRunId(j.runId ?? jobId);
          setLoading(false);
          loadHistory();
        } else if (j.status === "error") {
          stopPolling();
          setError(j.error || "研究失败，请重试");
          setLoading(false);
        }
      } catch {
        // 网络抖动忽略, 下次轮询继续
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
  async function run(override?: string, forceMode?: "search" | "verify") {
    const m = forceMode ?? mode;
    if (forceMode && forceMode !== mode) setMode(forceMode);
    const q = m === "search" ? (override ?? query) : query;
    const b = m === "verify" ? (override ?? bio) : bio;
    if (override !== undefined) {
      if (m === "search") setQuery(override);
      else setBio(override);
    }
    stopPolling();
    setLoading(true); setError(""); setResult(null); setStats(null);
    setFeed([]); setLive(null); setRunId(null); setCopied(false);
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
            let ev: any;
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
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setError(j.error ?? `HTTP ${res.status}`); setLoading(false); return; }
        if (j.queued && j.jobId) {
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

  return (
    <>
      <Landing />
      <main id="tool" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-16 pt-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      {/* 模式切换: 分段控件 */}
      <div className="inline-flex rounded-xl bg-gray-100 p-1">
        <button
          onClick={() => setMode("verify")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${mode === "verify" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
        >
          验证候选人 (打脸)
        </button>
        <button
          onClick={() => setMode("search")}
          className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${mode === "search" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-800"}`}
        >
          搜人
        </button>
      </div>

      <div className="mt-4">
        {mode === "search" ? (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如: Senior Rust engineer who contributed to tokio"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
        ) : (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="粘贴候选人的自述 / 简历 / LinkedIn 介绍..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
        )}

        {mode === "search" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">试试示例（秒出）:</span>
            {SEARCH_SAMPLES.map((s) => (
              <button
                key={s.query}
                onClick={() => run(s.query)}
                disabled={loading}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-900 hover:text-gray-900 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {mode === "verify" && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500">试试示例（秒出）:</span>
            {VERIFY_SAMPLES.map((s) => (
              <button
                key={s.label}
                onClick={() => run(s.bio)}
                disabled={loading}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-gray-600 transition hover:border-gray-900 hover:text-gray-900 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => run()}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50 sm:w-auto"
        >
          {loading ? "深度研究中…" : mode === "search" ? "搜索候选人" : "验证候选人"}
        </button>
      </div>
      </div>

      {loading && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            MiroMind 正在全网搜索 + 交叉核对…
            {live && (
              <span className="text-gray-500">
                （搜索 {live.searches} 次 · 抓取 {live.fetches} 次）
              </span>
            )}
          </div>
          {feed.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">已进入研究队列，深度研究约几分钟，进度会实时显示、完成后自动出结果…</p>
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
      {error && <p className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>}

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
          {mode === "search"
            ? (result.candidates ?? []).map((c: Candidate, i: number) => <CandidateCard key={i} c={c} />)
            : <TrustReportView r={result} />}
        </div>
      )}

      {history.length > 0 && (
        <section className="mt-10 border-t border-gray-200 pt-6">
          <h2 className="text-sm font-semibold text-gray-700">搜索历史</h2>
          <p className="mt-0.5 text-xs text-gray-400">点击任意一条可秒速重新打开（已存入数据库）</p>
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
                    <span className="truncate text-sm text-gray-800" title={h.query_text}>
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
