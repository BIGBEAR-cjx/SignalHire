"use client";

import { useEffect, useRef, useState } from "react";
import Landing from "./Landing";
import { SEARCH_SAMPLES, VERIFY_SAMPLES, HERO_BIO } from "@/lib/cache";

type FeedItem = { id: number; kind: "search" | "fetch"; info: string };
type HistoryItem = {
  kind: "search" | "verify";
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
};

// ---- 类型 ----
type Verdict = "verified" | "contradicted" | "unverified";
type Evidence = { note: string; url: string };
type Claim = { claim: string; verdict: Verdict; evidence: Evidence[] };
type Candidate = {
  name: string;
  headline: string;
  links: { github?: string | null; linkedin?: string | null; other?: string | null };
  claims: Claim[];
  summary: string;
};
type VerifyReport = {
  candidate_name: string;
  overall_trust: "high" | "medium" | "low";
  claims: Claim[];
  red_flags: string[];
};

// ---- 小组件 ----
function VerdictBadge({ v }: { v: Verdict }) {
  const map: Record<Verdict, { label: string; cls: string }> = {
    verified: { label: "✅ 已验证", cls: "bg-green-100 text-green-800 border-green-300" },
    contradicted: { label: "❌ 矛盾", cls: "bg-red-100 text-red-800 border-red-300" },
    unverified: { label: "⚠️ 查无实据", cls: "bg-amber-100 text-amber-800 border-amber-300" },
  };
  const { label, cls } = map[v] ?? map.unverified;
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function ClaimBlock({ c }: { c: Claim }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-gray-900">{c.claim}</p>
        <VerdictBadge v={c.verdict} />
      </div>
      {c.evidence?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {c.evidence.map((e, i) => (
            <li key={i} className="text-xs text-gray-600">
              • {e.note}{" "}
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer" className="text-blue-600 underline break-all">
                  来源
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CandidateCard({ c }: { c: Candidate }) {
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
      <p className="text-sm text-gray-600">{c.headline}</p>
      <div className="mt-1 flex gap-3 text-xs">
        {c.links?.github && <a href={c.links.github} target="_blank" rel="noreferrer" className="text-blue-600 underline">GitHub</a>}
        {c.links?.linkedin && <a href={c.links.linkedin} target="_blank" rel="noreferrer" className="text-blue-600 underline">LinkedIn</a>}
        {c.links?.other && <a href={c.links.other} target="_blank" rel="noreferrer" className="text-blue-600 underline">其他</a>}
      </div>
      <div className="mt-3 space-y-2">
        {c.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} />)}
      </div>
      <p className="mt-3 text-sm italic text-gray-700">{c.summary}</p>
    </div>
  );
}

function TrustReportView({ r }: { r: VerifyReport }) {
  const trust: Record<string, string> = {
    high: "bg-green-100 text-green-800 border-green-300",
    medium: "bg-amber-100 text-amber-800 border-amber-300",
    low: "bg-red-100 text-red-800 border-red-300",
  };
  return (
    <div className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{r.candidate_name}</h3>
        <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${trust[r.overall_trust] ?? trust.low}`}>
          可信度: {r.overall_trust}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {r.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} />)}
      </div>
      {r.red_flags?.length > 0 && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-800">🚩 红旗</p>
          <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
            {r.red_flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

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
  const idRef = useRef(0);

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
    setLoading(true); setError(""); setResult(null); setStats(null);
    setFeed([]); setLive(null);
    try {
      const url = m === "search" ? "/api/search" : "/api/verify";
      const body = m === "search" ? { query: q } : { bio: b };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      // 错误响应是普通 JSON (非流)
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      // 逐行读取 NDJSON 流: step 事件实时更新 feed, done 事件给最终结果
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
          } else if (ev.type === "error") {
            setError(ev.error || "出错了");
          }
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      loadHistory(); // 实时研究完成会写库 → 刷新历史面板
    }
  }

  return (
    <>
      <Landing />
      <main id="tool" className="mx-auto max-w-3xl scroll-mt-24 px-4 pb-16 pt-6">
      <div className="flex gap-2">
        <button
          onClick={() => setMode("verify")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "verify" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
        >
          验证候选人 (打脸)
        </button>
        <button
          onClick={() => setMode("search")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${mode === "search" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-700"}`}
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
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
          />
        ) : (
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="粘贴候选人的自述 / 简历 / LinkedIn 介绍..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
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
                className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-blue-400 disabled:opacity-50"
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
                className="rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-blue-400 disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => run()}
          disabled={loading}
          className="mt-3 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "深度研究中..." : mode === "search" ? "搜索候选人" : "验证"}
        </button>
      </div>

      {loading && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600" />
            MiroMind 正在全网搜索 + 交叉核对…
            {live && (
              <span className="text-gray-500">
                （搜索 {live.searches} 次 · 抓取 {live.fetches} 次）
              </span>
            )}
          </div>
          {feed.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">启动深度研究中，几秒后开始出现实时进度…</p>
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
      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">出错: {error}</p>}

      {result && (
        <div className="mt-6 space-y-4">
          {stats && (
            <p className="flex items-center gap-2 text-xs text-gray-500">
              {stats.cached ? (
                <span className="rounded-full border border-green-300 bg-green-100 px-2 py-0.5 font-medium text-green-800">
                  预缓存 · 秒出
                </span>
              ) : (
                <span>本次研究: 网页搜索 {stats.searches} 次 · 抓取 {stats.fetches} 次</span>
              )}
            </p>
          )}
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
