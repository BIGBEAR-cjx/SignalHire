"use client";

import { useState } from "react";
import { SEARCH_SAMPLES } from "@/lib/cache";

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

const SAMPLE_BIO = `Jordan Smith — Staff Software Engineer at Google.
I am the original creator of the Tokio asynchronous runtime for Rust, which I started in 2016.
I have 12 years of professional Rust experience and hold a PhD in Computer Science from Stanford.`;

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
  const [bio, setBio] = useState(SAMPLE_BIO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [stats, setStats] = useState<{ searches: number; fetches: number; cached?: boolean } | null>(null);

  async function run(overrideQuery?: string) {
    const q = overrideQuery ?? query;
    if (overrideQuery !== undefined) setQuery(overrideQuery);
    setLoading(true); setError(""); setResult(null); setStats(null);
    try {
      const url = mode === "search" ? "/api/search" : "/api/verify";
      const body = mode === "search" ? { query: q } : { bio };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json.data);
      setStats(json.stats ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold text-gray-900">HeadHunter</h1>
      <p className="mt-1 text-gray-600">用 MiroMind 深度搜索 + 跨源交叉验证候选人。每条结论都附证据。</p>

      <div className="mt-6 flex gap-2">
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

        <button
          onClick={() => run()}
          disabled={loading}
          className="mt-3 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white disabled:opacity-50"
        >
          {loading ? "深度研究中..." : mode === "search" ? "搜索候选人" : "验证"}
        </button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-gray-500">
          MiroMind 正在全网搜索 + 交叉核对，搜人约 4-8 分钟、验证约 2 分钟，请耐心等。
        </p>
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
    </main>
  );
}
