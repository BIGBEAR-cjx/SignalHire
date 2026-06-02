// components/result.tsx —— 候选人/验证结果的展示组件 (纯展示, 无 hooks)。
// 同时被 app/page.tsx (客户端工具) 和 app/r/[id]/page.tsx (服务端可分享报告) 复用。

declare module "@/lib/talent-profile.mjs" {
  export type CandidateComparisonRow = import("@/lib/talent-profile").CandidateComparisonRow;
  export type TalentCandidate = import("@/lib/talent-profile").TalentCandidate;
  export type TalentSearchResult = import("@/lib/talent-profile").TalentSearchResult;
}

import type { CandidateComparisonRow, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
import { buildCandidateComparisonRows } from "@/lib/talent-profile.mjs";
import {
  reportUniqueSources,
  sourceCountChip,
  sourceCountLabel,
  trustHeuristic,
  trustHeuristicChip,
  uniqueSourcesOf,
} from "@/lib/source-quality";

export type Verdict = "verified" | "contradicted" | "unverified";
export type Evidence = { note: string; url: string };
export type Claim = { claim: string; verdict: Verdict; evidence: Evidence[] };
export type Candidate = {
  name: string;
  headline: string;
  links: { github?: string | null; linkedin?: string | null; other?: string | null };
  claims: Claim[];
  summary: string;
};
export type VerifyReport = {
  candidate_name: string;
  overall_trust: "high" | "medium" | "low";
  claims: Claim[];
  red_flags: string[];
};

// 裁决语义色 (与 DESIGN-SYSTEM.md 一致)
const VERDICT: Record<Verdict, { label: string; icon: string; chip: string; bar: string }> = {
  verified: { label: "已验证", icon: "✓", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "border-l-emerald-400" },
  contradicted: { label: "矛盾", icon: "✕", chip: "bg-red-50 text-red-700 ring-red-200", bar: "border-l-red-400" },
  unverified: { label: "查无实据", icon: "?", chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "border-l-amber-400" },
};

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "来源"; }
}
function favicon(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ""; }
}

export function VerdictBadge({ v }: { v: Verdict }) {
  const m = VERDICT[v] ?? VERDICT.unverified;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.chip}`}>
      <span className="font-bold">{m.icon}</span>
      {m.label}
    </span>
  );
}

export function Tally({ claims }: { claims: Claim[] }) {
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

export function ClaimBlock({ c }: { c: Claim }) {
  const m = VERDICT[c.verdict] ?? VERDICT.unverified;
  const sourceCount = uniqueSourcesOf(c);
  return (
    <div className={`rounded-xl border-l-2 bg-gray-50/70 p-3.5 ${m.bar}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-gray-900">{c.claim}</p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <VerdictBadge v={c.verdict} />
          <span
            title="覆盖该声称的不同域名数 (越多越可靠)"
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${sourceCountChip(sourceCount)}`}
          >
            ⛓ {sourceCountLabel(sourceCount)}
          </span>
        </div>
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
                  className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 align-middle font-medium text-blue-600 ring-1 ring-gray-200 hover:ring-blue-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={favicon(e.url)} alt="" width={12} height={12} className="rounded-sm" />
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

const QUALITY: Record<string, string> = {
  high: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  medium: "bg-amber-50 text-amber-700 ring-amber-200",
  low: "bg-red-50 text-red-700 ring-red-200",
};

function ScorePill({ score }: { score: number }) {
  const tone = score >= 80 ? "bg-emerald-600" : score >= 65 ? "bg-amber-500" : "bg-gray-500";
  return (
    <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white ${tone}`}>
      {score}
    </span>
  );
}

function QualityPill({ value }: { value: string }) {
  const label = value === "high" ? "证据强" : value === "low" ? "证据弱" : "证据中等";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${QUALITY[value] ?? QUALITY.medium}`}>
      {label}
    </span>
  );
}

function PlanList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "blue" | "red" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    red: "bg-red-50 text-red-700 ring-red-100",
  }[tone];
  return (
    <div className={`rounded-xl p-4 ring-1 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      {items.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-2 text-sm opacity-70">未识别</p>
      )}
    </div>
  );
}

export function SearchPlanView({ result }: { result: TalentSearchResult }) {
  const plan = result.search_plan;
  if (!plan) return null;
  const hasPlan = plan.must_have.length || plan.nice_to_have.length || plan.exclusions.length || plan.source_strategy.length || plan.adjacent_pools.length;
  if (!hasPlan) return null;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">搜索计划</h2>
        <p className="mt-1 text-sm text-gray-500">系统如何拆解岗位画像、选择来源并扩展相邻人才池。</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <PlanList title="必须条件" items={plan.must_have} tone="emerald" />
        <PlanList title="加分条件" items={plan.nice_to_have} tone="blue" />
        <PlanList title="排除条件" items={plan.exclusions} tone="red" />
      </div>
      {plan.source_strategy.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {plan.source_strategy.map((source, i) => (
            <article key={`${source.source_type}-${i}`} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{source.source_type}</p>
              <h3 className="mt-1 text-sm font-semibold text-gray-900">{source.target}</h3>
              {source.reason && <p className="mt-2 text-sm leading-relaxed text-gray-600">{source.reason}</p>}
            </article>
          ))}
        </div>
      )}
      {plan.adjacent_pools.length > 0 && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-sm font-semibold text-blue-900">相邻人才池</p>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed text-blue-900/80">
            {plan.adjacent_pools.map((pool, i) => (
              <li key={`${pool.pool}-${i}`}>
                <span className="font-medium">{pool.pool}</span>
                {pool.reason && <span className="text-blue-800/70"> · {pool.reason}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function TalentMapView({ result }: { result: TalentSearchResult }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">AI 人才方向分布</h2>
        <p className="mt-1 text-sm text-gray-500">按岗位画像识别主匹配、相邻可迁移和高潜力人才池。</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {result.talent_map.map((item) => (
          <article key={item.direction} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">{item.direction}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                {item.candidate_count} 人
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-blue-600">{item.fit}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.rationale}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function CandidateComparisonView({ result }: { result: unknown }) {
  const rows: CandidateComparisonRow[] = buildCandidateComparisonRows(result);
  if (rows.length === 0) return null;
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">候选人对比</h2>
          <p className="mt-1 text-sm text-gray-500">按匹配度、证据强度、能力拆解和主要风险快速排序审阅。</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {rows.length} 人
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[960px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              <th className="border-b border-gray-100 px-3 py-2">候选人</th>
              <th className="border-b border-gray-100 px-3 py-2">方向</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">匹配</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">成果</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">技能</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">经历</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">证据</th>
              <th className="border-b border-gray-100 px-3 py-2">信源</th>
              <th className="border-b border-gray-100 px-3 py-2">主要信号 / 风险</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="align-top">
                <td className="border-b border-gray-100 px-3 py-3">
                  <p className="font-semibold text-gray-900">{row.name}</p>
                  {row.role && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{row.role}</p>}
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  {row.primary_direction ? (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                      {row.primary_direction}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">未识别</span>
                  )}
                  {row.secondary_directions && <p className="mt-1 text-xs leading-relaxed text-gray-500">{row.secondary_directions}</p>}
                </td>
                <td className="border-b border-gray-100 px-3 py-3 text-right font-semibold text-gray-900">{row.match_score}</td>
                <td className="border-b border-gray-100 px-3 py-3 text-right text-gray-600">{row.achievement_signals}</td>
                <td className="border-b border-gray-100 px-3 py-3 text-right text-gray-600">{row.skill_match}</td>
                <td className="border-b border-gray-100 px-3 py-3 text-right text-gray-600">{row.work_history}</td>
                <td className="border-b border-gray-100 px-3 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-medium text-gray-700">{row.evidence_score}</span>
                    <QualityPill value={row.evidence_quality} />
                  </div>
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{row.independent_sources}</p>
                  {row.source_types && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{row.source_types}</p>}
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  {row.top_signal && <p className="text-xs leading-relaxed text-emerald-700">{row.top_signal}</p>}
                  {row.risk_summary && <p className="mt-1 text-xs leading-relaxed text-amber-700">{row.risk_summary}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CandidateMeta({ candidate }: { candidate: TalentCandidate }) {
  const parts = [candidate.current_role, candidate.current_company, candidate.location].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="mt-1 text-sm text-gray-500">{parts.join(" / ")}</p>;
}

export function ShortlistCard({
  candidate,
  selected,
  onToggle,
  onOpen,
}: {
  candidate: TalentCandidate;
  selected: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
}) {
  const uncertainty = candidate.uncertainties[0];
  const topSignals = candidate.strongest_signals.slice(0, 3);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-3">
        <ScorePill score={candidate.match_score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
            <QualityPill value={candidate.evidence_audit.overall_evidence_quality} />
          </div>
          {candidate.headline && <p className="mt-1 text-sm leading-relaxed text-gray-700">{candidate.headline}</p>}
          <CandidateMeta candidate={candidate} />
        </div>
      </div>

      {candidate.ai_directions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {candidate.ai_directions.map((direction) => (
            <span key={direction} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              {direction}
            </span>
          ))}
        </div>
      )}

      {topSignals.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {topSignals.map((signal) => (
            <li key={signal} className="text-sm leading-relaxed text-gray-700">
              <span className="mr-1.5 font-semibold text-emerald-600">✓</span>
              {signal}
            </li>
          ))}
        </ul>
      )}

      {uncertainty && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-700 ring-1 ring-amber-100">
          {uncertainty}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          查看详情
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          className={`rounded-lg px-3 py-2 text-sm font-semibold ring-1 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:ring-gray-200 ${
            selected
              ? "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
          }`}
        >
          {selected ? "移出 shortlist" : "加入 shortlist"}
        </button>
      </div>
    </article>
  );
}

export function EvidenceAuditView({ audit }: { audit: TalentCandidate["evidence_audit"] }) {
  const rows = [
    { label: "已验证", items: audit.verified_claims, chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    { label: "未验证", items: audit.unverified_claims, chip: "bg-amber-50 text-amber-700 ring-amber-200" },
    { label: "矛盾", items: audit.contradicted_claims, chip: "bg-red-50 text-red-700 ring-red-200" },
    { label: "单一来源", items: audit.single_source_claims, chip: "bg-blue-50 text-blue-700 ring-blue-200" },
    { label: "身份风险", items: audit.identity_risks, chip: "bg-purple-50 text-purple-700 ring-purple-200" },
    { label: "时效说明", items: audit.recency_notes, chip: "bg-gray-50 text-gray-700 ring-gray-200" },
  ];

  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">证据审计</h4>
        <QualityPill value={audit.overall_evidence_quality} />
      </div>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <div key={row.label}>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${row.chip}`}>
              {row.label}
            </span>
            {row.items.length > 0 ? (
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
                {row.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            ) : (
              <p className="mt-1.5 text-sm text-gray-400">无</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EvidenceList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "amber" | "red" }) {
  const toneClass = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    red: "text-red-700",
  }[tone];
  return (
    <div className="mt-3">
      <p className={`text-xs font-semibold ${toneClass}`}>{title}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

export function EvidenceGraphView({ result, candidate }: { result: TalentSearchResult; candidate: TalentCandidate }) {
  const graph = result.evidence_graph;
  if (!graph) return null;
  const node = graph.candidates.find((item) => item.candidate_name === candidate.name);
  if (!node && !graph.summary && graph.source_mix.length === 0) return null;
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">证据图</h4>
        {node && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
            {node.independent_sources} 个独立信源
          </span>
        )}
      </div>
      {node?.source_types.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {node.source_types.map((type) => (
            <span key={type} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              {type}
            </span>
          ))}
        </div>
      ) : null}
      {node?.cross_validation ? <p className="mt-3 text-sm leading-relaxed text-gray-700">{node.cross_validation}</p> : null}
      {node?.strongest_evidence.length ? <EvidenceList title="最强证据" items={node.strongest_evidence} tone="emerald" /> : null}
      {node?.weakest_evidence.length ? <EvidenceList title="弱证据" items={node.weakest_evidence} tone="amber" /> : null}
      {node?.risk_flags.length ? <EvidenceList title="风险" items={node.risk_flags} tone="red" /> : null}
    </section>
  );
}

export function CandidateProfileView({ candidate }: { candidate: TalentCandidate }) {
  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-3">
        <ScorePill score={candidate.match_score} />
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
          {candidate.summary ? (
            <p className="mt-1 text-sm leading-relaxed text-gray-700">{candidate.summary}</p>
          ) : (
            candidate.headline && <p className="mt-1 text-sm leading-relaxed text-gray-700">{candidate.headline}</p>
          )}
          <CandidateMeta candidate={candidate} />
        </div>
      </div>

      {candidate.outreach_angle && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-sm font-semibold text-blue-700">Outreach angle</p>
          <p className="mt-1 text-sm leading-relaxed text-blue-900">{candidate.outreach_angle}</p>
        </div>
      )}

      <div className="mt-4">
        <EvidenceAuditView audit={candidate.evidence_audit} />
      </div>

      {candidate.claims.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {candidate.claims.map((claim, i) => <ClaimBlock key={i} c={claim} />)}
        </div>
      )}
    </article>
  );
}

export function CandidateCard({ c, delay = 0 }: { c: Candidate; delay?: number }) {
  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className="sh-fade-in-up rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
    >
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

// 可信度环形大徽章
function TrustRing({ level }: { level: "high" | "medium" | "low" }) {
  const meta = {
    high: { label: "高", ring: "ring-emerald-200 text-emerald-700 bg-emerald-50", pct: 92, stroke: "#10b981" },
    medium: { label: "中", ring: "ring-amber-200 text-amber-700 bg-amber-50", pct: 58, stroke: "#f59e0b" },
    low: { label: "低", ring: "ring-red-200 text-red-700 bg-red-50", pct: 24, stroke: "#ef4444" },
  }[level] ?? { label: "低", ring: "ring-red-200 text-red-700 bg-red-50", pct: 24, stroke: "#ef4444" };
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg className="absolute -rotate-90" width="80" height="80" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eee" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={meta.stroke} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - meta.pct / 100)} />
      </svg>
      <div className="text-center">
        <div className="text-[9px] font-medium uppercase tracking-wide text-gray-400">可信度</div>
        <div className={`text-xl font-bold leading-none ${level === "high" ? "text-emerald-600" : level === "medium" ? "text-amber-600" : "text-red-600"}`}>{meta.label}</div>
      </div>
    </div>
  );
}

export function TrustReportView({ r }: { r: VerifyReport }) {
  const totalSources = reportUniqueSources(r.claims);
  const heuristic = trustHeuristic(r);
  return (
    <article className="sh-fade-in-up rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{r.candidate_name}</h3>
          {r.claims?.length > 0 && <div className="mt-2"><Tally claims={r.claims} /></div>}
        </div>
        <TrustRing level={r.overall_trust} />
      </div>

      {/* 信源汇总 + 启发式信任度 (Phase 2.A.1 透明度增强) */}
      {r.claims?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs text-gray-600">
          <span className="font-medium text-gray-700">报告基于 {totalSources} 个独立信源</span>
          <span className="text-gray-300">·</span>
          <span title={heuristic.hint} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ${trustHeuristicChip(heuristic.level)}`}>
            {heuristic.label}
          </span>
          <span className="text-gray-400">— {heuristic.hint}</span>
        </div>
      )}

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

      {/* 自我披露 / 解读说明 (Phase 2.A.1) */}
      <details className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-xs text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">如何解读这份报告 · 局限性</summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>· 本报告由 AI (MiroMind) 自动抓取公开网页生成, 不构成对候选人最终判断, 仅作为<strong>第一道筛查</strong>。</p>
          <p>· &quot;已核实 / 矛盾 / 未核实&quot;是模型在抓取时的判断, 可能存在误判或漏判, 关键决策请人工复核每条声称的原始链接。</p>
          <p>· &quot;独立信源数&quot;= 该条声称的 evidence 中不同域名数 ; 数越多通常越可靠, 但同一来源转发不算独立。</p>
          <p>· 信源时效以抓取时刻为准, 公开网页内容可能已经更新, 请在做最终决策前点击原链接核对。</p>
          <p>· 未发现红旗 ≠ 候选人完全可信; 已发现红旗 ≠ 候选人不可用 (可能是同名 / 信源错误)。</p>
        </div>
      </details>
    </article>
  );
}
