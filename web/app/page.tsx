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

// ---- 设计令牌: 裁决语义色 (与 DESIGN-SYSTEM.md 一致) ----
const VERDICT: Record<Verdict, { label: string; icon: string; chip: string; bar: string }> = {
  verified: { label: "已验证", icon: "✓", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "border-l-emerald-400" },
  contradicted: { label: "矛盾", icon: "✕", chip: "bg-red-50 text-red-700 ring-red-200", bar: "border-l-red-400" },
  unverified: { label: "查无实据", icon: "?", chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "border-l-amber-400" },
};

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "来源"; }
}

// ---- 小组件 ----
function VerdictBadge({ v }: { v: Verdict }) {
  const m = VERDICT[v] ?? VERDICT.unverified;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.chip}`}>
      <span className="font-bold">{m.icon}</span>
      {m.label}
    </span>
  );
}

// 候选人卡头部的裁决统计
function Tally({ claims }: { claims: Claim[] }) {
  const counts = claims.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] ?? 0) + 1), a), {} as Record<Verdict, number>);
  const order: Verdict[] = ["verified", "unverified", "contradicted"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.filter((v) => counts[v]).map((v) => (
        <span key={v} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${VERDICT[v].chip}`}>
          <span className="font-bold">{VERDICT[v].icon}</span>
          {counts[v]} {VERDICT[v].label}
        </span>
      ))}
    </div>
  );
}

function ClaimBlock({ c }: { c: Claim }) {
  const m = VERDICT[c.verdict] ?? VERDICT.unverified;
  return (
    <div className={`rounded-xl border-l-2 bg-gray-50/70 p-3.5 ${m.bar}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-gray-900">{c.claim}</p>
        <VerdictBadge v={c.verdict} />
      </div>
      {c.evidence?.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {c.evidence.map((e, i) => (
            <li key={i} className="text-xs leading-relaxed text-gray-500">
              {e.note}
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1.5 inline-flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 font-medium text-blue-600 ring-1 ring-gray-200 hover:ring-blue-300"
                >
                  {host(e.url)} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
      {children}
    </a>
  );
}

function CandidateCard({ c }: { c: Candidate }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{c.headline}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {c.links?.github && <LinkPill href={c.links.github}>GitHub</LinkPill>}
          {c.links?.linkedin && <LinkPill href={c.links.linkedin}>LinkedIn</LinkPill>}
          {c.links?.other && <LinkPill href={c.links.other}>主页</LinkPill>}
        </div>
      </div>
      {c.claims?.length > 0 && <div className="mt-3"><Tally claims={c.claims} /></div>}
      <div className="mt-3 space-y-2.5">
        {c.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} />)}
      </div>
      <p className="mt-4 border-t border-gray-100 pt-3 text-sm italic text-gray-500">{c.summary}</p>
    </article>
  );
}

function TrustReportView({ r }: { r: VerifyReport }) {
  const trust: Record<string, { ring: string; label: string }> = {
    high: { ring: "bg-emerald-50 text-emerald-700 ring-emerald-200", label: "高" },
    medium: { ring: "bg-amber-50 text-amber-700 ring-amber-200", label: "中" },
    low: { ring: "bg-red-50 text-red-700 ring-red-200", label: "低" },
  };
  const t = trust[r.overall_trust] ?? trust.low;
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{r.candidate_name}</h3>
          {r.claims?.length > 0 && <div className="mt-2"><Tally claims={r.claims} /></div>}
        </div>
        <div className={`flex shrink-0 flex-col items-center justify-center rounded-2xl px-4 py-2 ring-1 ${t.ring}`}>
          <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">可信度</span>
          <span className="text-lg font-bold leading-none">{t.label}</span>
        </div>
      </div>
      <div className="mt-4 space-y-2.5">
        {r.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} />)}
      </div>
      {r.red_flags?.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/60 p-4">
          <p className="text-sm font-semibold text-red-700">🚩 红旗</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-600/90">
            {r.red_flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </article>
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
      {error && <p className="mt-5 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>}

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
