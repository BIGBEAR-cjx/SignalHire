// components/result.tsx —— 候选人/验证结果的展示组件 (纯展示, 无 hooks)。
// 同时被 app/page.tsx (客户端工具) 和 app/r/[id]/page.tsx (服务端可分享报告) 复用。

declare module "@/lib/talent-profile.mjs" {
  export type CandidateComparisonRow = import("@/lib/talent-profile").CandidateComparisonRow;
  export type CandidateReadingSummary = import("@/lib/talent-profile").CandidateReadingSummary;
  export type CandidateEvidenceDossier = import("@/lib/talent-profile").CandidateEvidenceDossier;
  export type BackfillMergeSummary = import("@/lib/talent-profile").BackfillMergeSummary;
  export type CoverageBackfillJob = import("@/lib/talent-profile").CoverageBackfillJob;
  export type CandidateEvidenceAuditSummary = import("@/lib/talent-profile").CandidateEvidenceAuditSummary;
  export type EvidenceCoverageGroup = import("@/lib/talent-profile").EvidenceCoverageGroup;
  export type ShortlistDeliveryReport = import("@/lib/talent-profile").ShortlistDeliveryReport;
  export type SourceExecutionJob = import("@/lib/talent-profile").SourceExecutionJob;
  export type SourceQueryPlanItem = import("@/lib/talent-profile").SourceQueryPlanItem;
  export type TalentCandidate = import("@/lib/talent-profile").TalentCandidate;
  export type TalentSearchResult = import("@/lib/talent-profile").TalentSearchResult;
}

import type { BackfillMergeSummary, CandidateComparisonRow, CandidateEvidenceAuditSummary, CandidateReadingSummary, CandidateEvidenceDossier, CoverageBackfillJob, EvidenceCoverageGroup, ShortlistDeliveryReport, SourceExecutionJob, SourceQueryPlanItem, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
import { buildCandidateComparisonRows, buildCandidateEvidenceAudit, buildCandidateReadingSummary, buildCandidateEvidenceDossier, buildCoverageBackfillPlan, buildEvidenceCoverage, buildShortlistDeliveryReport, buildSourceExecution, buildSourceQueryPlan } from "@/lib/talent-profile.mjs";
import type { IconType } from "react-icons";
import { FiCheckCircle, FiExternalLink, FiFlag, FiHelpCircle, FiInfo, FiLink2, FiXCircle } from "react-icons/fi";
import { t as translate } from "@/lib/i18n.mjs";
import {
  reportUniqueSources,
  sourceCountChip,
  sourceCountLabel,
  trustHeuristic,
  trustHeuristicChip,
  uniqueSourcesOf,
} from "@/lib/source-quality";

type Locale = "zh" | "en";

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

type ResultLocaleProps = { locale?: Locale };
type EvidencePriorityItemView = {
  candidate_index: number;
  name: string;
  role: string;
  match_score: number;
  evidence_quality: string;
  independent_sources: number;
  verified_count: number;
  unverified_count: number;
  contradicted_count: number;
  priority: string;
  priority_label: string;
  priority_reason: string;
  recommended_action: string;
};
type EvidencePriorityViewModel = {
  summary: {
    ready_to_review: number;
    needs_backfill: number;
    risk_review: number;
  };
  items: EvidencePriorityItemView[];
  empty: boolean;
};

function uiCopy(locale: Locale | undefined, key: string, params?: Record<string, string | number>) {
  return translate(locale ?? "zh", key, params);
}

const RESULT_COPY = {
  zh: {
    unknownCandidate: "未知候选人",
    source: "来源",
    verified: "已验证",
    contradicted: "矛盾",
    unverified: "查无实据",
    sourceCountTitle: "覆盖该声称的不同域名数 (越多越可靠)",
    evidenceStrong: "证据强",
    evidenceMedium: "证据中等",
    evidenceWeak: "证据弱",
    deliveryTitle: "交付报告摘要",
    deliveryBadge: "招聘候选名单",
    candidates: "候选人",
    strongRecommendations: "{count} 位强推荐",
    averageMatch: "平均匹配分",
    strongEvidenceCandidates: "证据强候选人",
    sourceCoverage: "信息源覆盖",
    priorityReview: "优先审阅候选人",
    sourcesShort: "信源",
    deliveryRisks: "交付风险",
    nextSteps: "建议下一步",
    searchPlanTitle: "搜索计划",
    searchPlanDesc: "系统如何拆解岗位画像、选择来源并扩展相邻人才池。",
    mustHave: "必须条件",
    niceToHave: "加分条件",
    exclusions: "排除条件",
    notIdentified: "未识别",
    sourceQueryPlan: "来源查询计划",
    items: "条",
    adjacentPools: "相邻人才池",
    research: "研究",
    practice: "实践",
    work_history: "工作经历",
    public_voice: "公开表达",
    planned: "待执行",
    completed: "已完成",
    partial: "部分完成",
    failed: "失败",
    sourceExecutionTitle: "来源执行记录",
    sourceExecutionReturned: "记录每类来源任务的实际查询、具体链接、证据数量和后续缺口。",
    sourceExecutionPlanned: "本次结果未返回执行记录，先展示可执行的来源任务计划。",
    executed: "已执行",
    evidence: "证据",
    links: "链接",
    leads: "线索",
    backfillTitle: "缺口补搜计划",
    backfillDesc: "把缺失或偏弱的信息源覆盖转成下一轮可执行查询。",
    gaps: "个缺口",
    plannedBackfill: "待补搜",
    completedBackfill: "已补齐",
    skippedBackfill: "已跳过",
    affectedCandidates: "影响候选人",
    prioritySources: "优先来源",
    enqueueingBackfill: "补搜入队中…",
    backfillGap: "补搜这个缺口",
    backfillDeltaTitle: "补搜证据增量",
    candidateBackfillMerged: "已回流到候选人档案",
    merged: "已合并",
    mergeable: "可合并",
    newSources: "新增来源",
    newEvidence: "+{count} 证据",
    backfillNewCandidates: "补搜还发现新候选人：{names}",
    mergedBack: "已合并回原报告",
    merging: "正在合并…",
    mergeBack: "合并回原报告",
    talentMapTitle: "AI 人才方向分布",
    talentMapDesc: "按岗位画像识别主匹配、相邻可迁移和高潜力人才池。",
    people: "人",
    evidenceCoverageTitle: "信息源覆盖",
    evidenceCoverageDesc: "按研究、实践、工作经历和公开表达检查交叉验证基础。",
    missing: "缺",
    comparisonTitle: "候选人对比",
    comparisonDesc: "按匹配度、证据强度、能力拆解和主要风险快速排序审阅。",
    direction: "方向",
    match: "匹配",
    achievements: "成果",
    skills: "技能",
    workHistory: "经历",
    sourceTypes: "信源",
    signalRisk: "主要信号 / 风险",
    gapPrefix: "缺口",
    viewDetails: "查看详情",
    removeFromPool: "移出候选池",
    addToPool: "加入候选池",
    auditTitle: "证据审计",
    dossierCoverage: "证据覆盖",
    verificationGaps: "待补验证",
    independentSources: "{count} 个独立信源",
    singleSourceClaims: "单源声称",
    identityRisk: "身份风险",
    recencyNotes: "时效说明",
    none: "无",
    strongestEvidence: "最强证据",
    weakEvidence: "弱证据",
    riskFlags: "风险提示",
    evidenceGraph: "证据图",
    risk: "风险",
    outreachAngle: "外联角度",
    homepage: "主页",
    trust: "可信度",
    high: "高",
    medium: "中",
    low: "低",
    redFlags: "红旗",
    reportBasedOn: "报告基于 {count} 个独立信源",
    reportCaveatTitle: "如何解读这份报告 · 局限性",
    caveat1: "本报告由 AI 自动抓取公开网页生成，不构成对候选人最终判断，仅作为第一道筛查。",
    caveat2: "\"已核实 / 矛盾 / 未核实\"是模型在抓取时的判断，可能存在误判或漏判，关键决策请人工复核每条声称的原始链接。",
    caveat3: "\"独立信源数\"= 该条声称的 evidence 中不同域名数；数越多通常越可靠，但同一来源转发不算独立。",
    caveat4: "信源时效以抓取时刻为准，公开网页内容可能已经更新，请在做最终决策前点击原链接核对。",
    caveat5: "未发现红旗不代表候选人完全可信；已发现红旗也不代表候选人不可用，可能是同名或信源错误。",
  },
  en: {
    unknownCandidate: "Unknown candidate",
    source: "Source",
    verified: "Verified",
    contradicted: "Contradicted",
    unverified: "No evidence found",
    sourceCountTitle: "Number of distinct domains covering this claim (more is stronger)",
    evidenceStrong: "Strong evidence",
    evidenceMedium: "Moderate evidence",
    evidenceWeak: "Weak evidence",
    deliveryTitle: "Delivery summary",
    deliveryBadge: "Recruiting shortlist",
    candidates: "Candidates",
    strongRecommendations: "{count} strong recommendations",
    averageMatch: "Average match",
    strongEvidenceCandidates: "Strong-evidence candidates",
    sourceCoverage: "Source coverage",
    priorityReview: "Priority review candidates",
    sourcesShort: "sources",
    deliveryRisks: "Delivery risks",
    nextSteps: "Suggested next steps",
    searchPlanTitle: "Search plan",
    searchPlanDesc: "How the system decomposed the role profile, selected sources, and expanded adjacent talent pools.",
    mustHave: "Must-have",
    niceToHave: "Nice-to-have",
    exclusions: "Exclusions",
    notIdentified: "Not identified",
    sourceQueryPlan: "Source query plan",
    items: "items",
    adjacentPools: "Adjacent talent pools",
    research: "Research",
    practice: "Practice",
    work_history: "Work history",
    public_voice: "Public voice",
    planned: "Planned",
    completed: "Completed",
    partial: "Partial",
    failed: "Failed",
    sourceExecutionTitle: "Source execution log",
    sourceExecutionReturned: "Shows the actual query, links, evidence count, and remaining gaps for each source task.",
    sourceExecutionPlanned: "This result did not return execution logs, so the executable source plan is shown instead.",
    executed: "executed",
    evidence: "evidence",
    links: "links",
    leads: "Leads",
    backfillTitle: "Gap backfill plan",
    backfillDesc: "Turns missing or weak source coverage into executable queries for the next round.",
    gaps: "gaps",
    plannedBackfill: "Backfill planned",
    completedBackfill: "Backfilled",
    skippedBackfill: "Skipped",
    affectedCandidates: "Affected candidates",
    prioritySources: "Priority sources",
    enqueueingBackfill: "Queueing backfill...",
    backfillGap: "Backfill this gap",
    backfillDeltaTitle: "Backfill evidence delta",
    candidateBackfillMerged: "Merged into this candidate dossier",
    merged: "Merged",
    mergeable: "Mergeable",
    newSources: "New sources",
    newEvidence: "+{count} evidence",
    backfillNewCandidates: "Backfill also found new candidates: {names}",
    mergedBack: "Merged into original report",
    merging: "Merging...",
    mergeBack: "Merge into original report",
    talentMapTitle: "AI talent map",
    talentMapDesc: "Groups candidates by primary fit, adjacent transferability, and high-potential talent pools.",
    people: "people",
    evidenceCoverageTitle: "Source coverage",
    evidenceCoverageDesc: "Checks the cross-validation base across research, practice, work history, and public voice.",
    missing: "Missing",
    comparisonTitle: "Candidate comparison",
    comparisonDesc: "Quickly rank candidates by match, evidence strength, capability breakdown, and primary risks.",
    direction: "Direction",
    match: "Match",
    achievements: "Achievements",
    skills: "Skills",
    workHistory: "Work history",
    sourceTypes: "Sources",
    signalRisk: "Key signal / risk",
    gapPrefix: "Gap",
    viewDetails: "View details",
    removeFromPool: "Remove from pool",
    addToPool: "Add to pool",
    auditTitle: "Evidence audit",
    dossierCoverage: "Evidence coverage",
    verificationGaps: "Verification gaps",
    independentSources: "{count} independent sources",
    singleSourceClaims: "Single-source claims",
    identityRisk: "Identity risk",
    recencyNotes: "Recency notes",
    none: "None",
    strongestEvidence: "Strongest evidence",
    weakEvidence: "Weak evidence",
    riskFlags: "Risk flags",
    evidenceGraph: "Evidence graph",
    risk: "Risk",
    outreachAngle: "Outreach angle",
    homepage: "Website",
    trust: "Trust",
    high: "High",
    medium: "Medium",
    low: "Low",
    redFlags: "Red flags",
    reportBasedOn: "Based on {count} independent sources",
    reportCaveatTitle: "How to read this report · limitations",
    caveat1: "This report is generated by AI from public web pages. It is a first screening aid, not a final judgment on the candidate.",
    caveat2: "\"Verified / contradicted / unverified\" are model judgments at crawl time and may contain false positives or omissions. Review the original links before making important decisions.",
    caveat3: "\"Independent sources\" means distinct domains in the evidence for a claim. More sources usually help, but reposts from one origin are not independent.",
    caveat4: "Source freshness is based on crawl time. Public pages may have changed; check the original links before final decisions.",
    caveat5: "No red flags does not mean the candidate is fully reliable. A red flag does not mean the candidate is unusable; it may come from name ambiguity or source error.",
  },
} as const;

function resultCopy(locale: Locale | undefined, key: keyof typeof RESULT_COPY.zh, params: Record<string, string | number> = {}) {
  let text: string = RESULT_COPY[locale === "en" ? "en" : "zh"][key] ?? RESULT_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

// 裁决语义色 (与 DESIGN-SYSTEM.md 一致)
const VERDICT: Record<Verdict, { labelKey: "verified" | "contradicted" | "unverified"; Icon: IconType; chip: string; panel: string }> = {
  verified: { labelKey: "verified", Icon: FiCheckCircle, chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", panel: "border-emerald-100 bg-emerald-50/45" },
  contradicted: { labelKey: "contradicted", Icon: FiXCircle, chip: "bg-red-50 text-red-700 ring-red-200", panel: "border-red-100 bg-red-50/45" },
  unverified: { labelKey: "unverified", Icon: FiHelpCircle, chip: "bg-amber-50 text-amber-700 ring-amber-200", panel: "border-amber-100 bg-amber-50/45" },
};

function ResultSurface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)] backdrop-blur-xl ${className}`}>
      {children}
    </section>
  );
}

function host(url: string, locale?: Locale): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return resultCopy(locale, "source"); }
}
function favicon(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ""; }
}

export function VerdictBadge({ v, locale }: { v: Verdict } & ResultLocaleProps) {
  const m = VERDICT[v] ?? VERDICT.unverified;
  const Icon = m.Icon;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.chip}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {resultCopy(locale, m.labelKey)}
    </span>
  );
}

export function Tally({ claims, locale }: { claims: Claim[] } & ResultLocaleProps) {
  const counts = claims.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] ?? 0) + 1), a), {} as Record<Verdict, number>);
  const order: Verdict[] = ["verified", "unverified", "contradicted"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.filter((v) => counts[v]).map((v) => (
        <span key={v} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${VERDICT[v].chip}`}>
          {(() => {
            const Icon = VERDICT[v].Icon;
            return <Icon className="h-3.5 w-3.5" aria-hidden="true" />;
          })()}
          {counts[v]} {resultCopy(locale, VERDICT[v].labelKey)}
        </span>
      ))}
    </div>
  );
}

export function ClaimBlock({ c, locale }: { c: Claim } & ResultLocaleProps) {
  const m = VERDICT[c.verdict] ?? VERDICT.unverified;
  const sourceCount = uniqueSourcesOf(c);
  return (
    <div className={`rounded-xl border p-3.5 ${m.panel}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-gray-900">{c.claim}</p>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <VerdictBadge v={c.verdict} locale={locale} />
          <span
            title={resultCopy(locale, "sourceCountTitle")}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ${sourceCountChip(sourceCount)}`}
          >
            <FiLink2 className="h-3 w-3" aria-hidden="true" />
            {sourceCountLabel(sourceCount, locale)}
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
                  {host(e.url, locale)}
                  <FiExternalLink className="h-3 w-3" aria-hidden="true" />
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
  const tone = score >= 80
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : score >= 65
      ? "bg-amber-50 text-amber-700 ring-amber-200"
      : "bg-neutral-100 text-neutral-700 ring-neutral-200";
  return (
    <span className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ring-1 ${tone}`}>
      {score}
    </span>
  );
}

function QualityPill({ value, locale }: { value: string } & ResultLocaleProps) {
  const label = value === "high" ? resultCopy(locale, "evidenceStrong") : value === "low" ? resultCopy(locale, "evidenceWeak") : resultCopy(locale, "evidenceMedium");
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${QUALITY[value] ?? QUALITY.medium}`}>
      {label}
    </span>
  );
}

function ReportMetric({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="rounded-2xl bg-white/72 p-4 ring-1 ring-black/5">
      <p className="text-2xl font-semibold leading-none text-gray-900">{value}</p>
      <p className="mt-1 text-xs font-semibold text-gray-500">{label}</p>
      {sublabel && <p className="mt-1 text-xs leading-relaxed text-gray-400">{sublabel}</p>}
    </div>
  );
}

export function ShortlistDeliveryReportView({ result, locale }: { result: TalentSearchResult } & ResultLocaleProps) {
  const report: ShortlistDeliveryReport = buildShortlistDeliveryReport(result);
  if (report.candidate_count === 0) return null;
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "deliveryTitle")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{report.brief_summary}</p>
        </div>
        <span className="rounded-full bg-gray-900 px-2.5 py-1 text-xs font-semibold text-white">
          {resultCopy(locale, "deliveryBadge")}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric label={resultCopy(locale, "candidates")} value={report.candidate_count} sublabel={resultCopy(locale, "strongRecommendations", { count: report.strong_recommendation_count })} />
        <ReportMetric label={resultCopy(locale, "averageMatch")} value={report.average_match_score} />
        <ReportMetric label={resultCopy(locale, "strongEvidenceCandidates")} value={report.high_evidence_count} />
        <ReportMetric label={resultCopy(locale, "sourceCoverage")} value={`${report.covered_group_count}/${report.coverage_group_count}`} />
      </div>
      {report.recommended_candidates.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-900">{resultCopy(locale, "priorityReview")}</p>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {report.recommended_candidates.map((candidate) => (
              <article key={candidate.name} className="rounded-2xl border border-black/10 bg-white/72 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900">{candidate.name}</h3>
                    {candidate.role && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{candidate.role}</p>}
                  </div>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
                    {candidate.match_score}
                  </span>
                </div>
                {candidate.recommendation_reason && (
                  <p className="mt-2 text-sm leading-relaxed text-gray-700">{candidate.recommendation_reason}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <QualityPill value={candidate.evidence_quality} locale={locale} />
                  {candidate.independent_sources > 0 && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                      {candidate.independent_sources} {resultCopy(locale, "sourcesShort")}
                    </span>
                  )}
                </div>
                {candidate.primary_risk && <p className="mt-2 text-xs leading-relaxed text-amber-700">{candidate.primary_risk}</p>}
              </article>
            ))}
          </div>
        </div>
      )}
      {(report.report_risks.length > 0 || report.next_steps.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {report.report_risks.length > 0 && (
            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
              <p className="text-sm font-semibold text-amber-900">{resultCopy(locale, "deliveryRisks")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-amber-800">
                {report.report_risks.map((risk) => <li key={risk}>{risk}</li>)}
              </ul>
            </div>
          )}
          {report.next_steps.length > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
              <p className="text-sm font-semibold text-blue-900">{resultCopy(locale, "nextSteps")}</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-blue-900/80">
                {report.next_steps.map((step) => <li key={step}>{step}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </ResultSurface>
  );
}

function PlanList({ title, items, tone, locale }: { title: string; items: string[]; tone: "emerald" | "blue" | "red" } & ResultLocaleProps) {
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
        <p className="mt-2 text-sm opacity-70">{resultCopy(locale, "notIdentified")}</p>
      )}
    </div>
  );
}

export function SearchPlanView({ result, locale }: { result: TalentSearchResult } & ResultLocaleProps) {
  const plan = result.search_plan;
  if (!plan) return null;
  const hasPlan = plan.must_have.length || plan.nice_to_have.length || plan.exclusions.length || plan.source_strategy.length || plan.adjacent_pools.length;
  if (!hasPlan) return null;
  const queryPlan = buildSourceQueryPlan(result) as SourceQueryPlanItem[];
  return (
    <ResultSurface>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "searchPlanTitle")}</h2>
        <p className="mt-1 text-sm text-gray-500">{resultCopy(locale, "searchPlanDesc")}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <PlanList title={resultCopy(locale, "mustHave")} items={plan.must_have} tone="emerald" locale={locale} />
        <PlanList title={resultCopy(locale, "niceToHave")} items={plan.nice_to_have} tone="blue" locale={locale} />
        <PlanList title={resultCopy(locale, "exclusions")} items={plan.exclusions} tone="red" locale={locale} />
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
      {queryPlan.length > 0 && (
        <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{resultCopy(locale, "sourceQueryPlan")}</p>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
              {queryPlan.length} {resultCopy(locale, "items")}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {queryPlan.map((item) => (
              <article key={`${item.priority}-${item.source_type}`} className="rounded-lg bg-white p-3 ring-1 ring-gray-100">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                    {item.priority}
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                    {item.source_type}
                  </span>
                  <span className="text-xs text-gray-400">{coverageGroupLabel(item.coverage_group, locale)}</span>
                </div>
                <p className="mt-2 break-words font-mono text-xs leading-relaxed text-gray-700">{item.query}</p>
                {(item.target || item.reason) && (
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">
                    {item.target}
                    {item.target && item.reason ? " · " : ""}
                    {item.reason}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {plan.adjacent_pools.length > 0 && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
          <p className="text-sm font-semibold text-blue-900">{resultCopy(locale, "adjacentPools")}</p>
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
    </ResultSurface>
  );
}

function coverageGroupLabel(value: string, locale?: Locale) {
  return {
    research: resultCopy(locale, "research"),
    practice: resultCopy(locale, "practice"),
    work_history: resultCopy(locale, "work_history"),
    public_voice: resultCopy(locale, "public_voice"),
  }[value] ?? value;
}

function sourceExecutionStatusMeta(status: SourceExecutionJob["status"], locale?: Locale) {
  return {
    planned: { label: resultCopy(locale, "planned"), chip: "bg-gray-50 text-gray-600 ring-gray-200" },
    completed: { label: resultCopy(locale, "completed"), chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    partial: { label: resultCopy(locale, "partial"), chip: "bg-amber-50 text-amber-700 ring-amber-200" },
    failed: { label: resultCopy(locale, "failed"), chip: "bg-red-50 text-red-700 ring-red-200" },
  }[status] ?? { label: status, chip: "bg-gray-50 text-gray-600 ring-gray-200" };
}

export function SourceExecutionView({ result, locale }: { result: TalentSearchResult } & ResultLocaleProps) {
  const execution = buildSourceExecution(result);
  const visibleJobs: SourceExecutionJob[] = execution.jobs.filter((job: SourceExecutionJob) => job.status !== "planned" || job.query || job.next_action);
  if (visibleJobs.length === 0) return null;
  const hasReturnedExecution = result.source_execution.jobs.length > 0;
  const executedCount = visibleJobs.filter((job) => job.status !== "planned").length;
  const evidenceCount = visibleJobs.reduce((total, job) => total + job.evidence_found, 0);
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "sourceExecutionTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">
            {hasReturnedExecution ? resultCopy(locale, "sourceExecutionReturned") : resultCopy(locale, "sourceExecutionPlanned")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
            {executedCount} / {visibleJobs.length} {resultCopy(locale, "executed")}
          </span>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
            {evidenceCount} {resultCopy(locale, "evidence")}
          </span>
        </div>
      </div>
      {execution.summary && <p className="mt-3 text-sm leading-relaxed text-gray-600">{execution.summary}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleJobs.map((job) => {
          const status = sourceExecutionStatusMeta(job.status, locale);
          return (
            <article key={job.job_id} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${status.chip}`}>
                  {status.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                  {job.source_type}
                </span>
                <span className="text-xs text-gray-400">{coverageGroupLabel(job.coverage_group, locale)}</span>
              </div>
              <p className="mt-3 break-words font-mono text-xs leading-relaxed text-gray-700">{job.query}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-gray-600">
                <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-gray-200">{job.urls_found} {resultCopy(locale, "links")}</span>
                <span className="rounded-full bg-white px-2 py-0.5 ring-1 ring-gray-200">{job.evidence_found} {resultCopy(locale, "evidence")}</span>
              </div>
              {job.candidate_leads.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  {resultCopy(locale, "leads")}: {job.candidate_leads.slice(0, 4).join(", ")}
                </p>
              )}
              {job.source_urls.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs leading-relaxed text-gray-500">
                  {job.source_urls.slice(0, 3).map((url) => (
                    <li key={url} className="truncate">
                      <a className="hover:text-gray-900 hover:underline" href={url} target="_blank" rel="noreferrer">
                        {host(url, locale)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {(job.error || job.next_action) && (
                <p className={`mt-3 text-xs leading-relaxed ${job.error ? "text-red-600" : "text-gray-500"}`}>
                  {job.error || job.next_action}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </ResultSurface>
  );
}

function backfillStatusMeta(status: CoverageBackfillJob["status"], locale?: Locale) {
  return {
    planned: { label: resultCopy(locale, "plannedBackfill"), chip: "bg-blue-50 text-blue-700 ring-blue-100" },
    completed: { label: resultCopy(locale, "completedBackfill"), chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    skipped: { label: resultCopy(locale, "skippedBackfill"), chip: "bg-gray-50 text-gray-600 ring-gray-200" },
  }[status] ?? { label: status, chip: "bg-gray-50 text-gray-600 ring-gray-200" };
}

export function CoverageBackfillView({
  result,
  onBackfillJob,
  backfillDisabled = false,
  locale,
}: {
  result: TalentSearchResult;
  onBackfillJob?: (job: CoverageBackfillJob) => void;
  backfillDisabled?: boolean;
} & ResultLocaleProps) {
  const plan = buildCoverageBackfillPlan(result);
  const jobs: CoverageBackfillJob[] = plan.jobs.filter((job: CoverageBackfillJob) => job.query || job.reason);
  if (jobs.length === 0) return null;
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "backfillTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">{resultCopy(locale, "backfillDesc")}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
          {jobs.length} {resultCopy(locale, "gaps")}
        </span>
      </div>
      {plan.summary && <p className="mt-3 text-sm leading-relaxed text-gray-600">{plan.summary}</p>}
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {jobs.map((job) => {
          const status = backfillStatusMeta(job.status, locale);
          return (
            <article key={job.gap_id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-gray-900 px-2 py-0.5 text-xs font-semibold text-white">
                  {job.priority}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${status.chip}`}>
                  {status.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                  {job.missing_source_type}
                </span>
                <span className="text-xs text-gray-500">{coverageGroupLabel(job.coverage_group, locale)}</span>
              </div>
              <p className="mt-3 break-words font-mono text-xs leading-relaxed text-gray-700">{job.query}</p>
              {job.reason && <p className="mt-2 text-xs leading-relaxed text-gray-600">{job.reason}</p>}
              {job.candidate_names.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-blue-900/70">
                  {resultCopy(locale, "affectedCandidates")}: {job.candidate_names.slice(0, 5).join(", ")}
                </p>
              )}
              {job.source_types_to_check.length > 0 && (
                <p className="mt-1 text-xs leading-relaxed text-gray-500">
                  {resultCopy(locale, "prioritySources")}: {job.source_types_to_check.join(", ")}
                </p>
              )}
              {onBackfillJob && (
                <button
                  type="button"
                  onClick={() => onBackfillJob(job)}
                  disabled={backfillDisabled || job.status !== "planned"}
                  className="mt-3 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {backfillDisabled ? resultCopy(locale, "enqueueingBackfill") : resultCopy(locale, "backfillGap")}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </ResultSurface>
  );
}

export function BackfillMergeSummaryView({
  summary,
  onMerge,
  mergeDisabled = false,
  merged = false,
  locale,
}: {
  summary: BackfillMergeSummary;
  onMerge?: () => void;
  mergeDisabled?: boolean;
  merged?: boolean;
} & ResultLocaleProps) {
  const hasCandidates = summary.improved_candidates.length > 0;
  const hasCoverage = summary.coverage_gains.length > 0;
  if (!hasCandidates && !hasCoverage && summary.new_candidate_names.length === 0) return null;
  return (
    <ResultSurface className="border-emerald-100 bg-emerald-50/60">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "backfillDeltaTitle")}</h2>
          <p className="mt-1 text-sm text-emerald-900/70">{summary.summary}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
          {merged ? resultCopy(locale, "merged") : resultCopy(locale, "mergeable")}
        </span>
      </div>
      {hasCoverage && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {summary.coverage_gains.map((gain) => (
            <article key={gain.key} className="rounded-xl bg-white p-4 ring-1 ring-emerald-100">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{gain.label}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {gain.before_count} → {gain.after_count}
                </span>
              </div>
              {gain.added_source_types.length > 0 && (
                <p className="mt-2 text-xs leading-relaxed text-gray-600">
                  {resultCopy(locale, "newSources")}: {gain.added_source_types.join(", ")}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {hasCandidates && (
        <div className="mt-4 space-y-3">
          {summary.improved_candidates.map((candidate) => (
            <article key={candidate.candidate_name} className="rounded-xl bg-white p-4 ring-1 ring-emerald-100">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{candidate.candidate_name}</h3>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {resultCopy(locale, "newEvidence", { count: candidate.new_evidence_count })}
                </span>
                {candidate.new_source_types.map((type) => (
                  <span key={type} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                    {type}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{candidate.merge_note}</p>
              {candidate.new_evidence_urls.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs leading-relaxed text-gray-500">
                  {candidate.new_evidence_urls.slice(0, 4).map((url) => (
                    <li key={url} className="truncate">
                      <a className="hover:text-gray-900 hover:underline" href={url} target="_blank" rel="noreferrer">
                        {host(url, locale)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
      {summary.new_candidate_names.length > 0 && (
        <p className="mt-4 text-xs leading-relaxed text-gray-600">
          {resultCopy(locale, "backfillNewCandidates", { names: summary.new_candidate_names.join(", ") })}
        </p>
      )}
      {onMerge && (
        <button
          type="button"
          onClick={onMerge}
          disabled={mergeDisabled || merged}
          className="mt-4 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {merged ? resultCopy(locale, "mergedBack") : mergeDisabled ? resultCopy(locale, "merging") : resultCopy(locale, "mergeBack")}
        </button>
      )}
    </ResultSurface>
  );
}

export function TalentMapView({ result, locale }: { result: TalentSearchResult } & ResultLocaleProps) {
  return (
    <ResultSurface>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "talentMapTitle")}</h2>
        <p className="mt-1 text-sm text-gray-500">{resultCopy(locale, "talentMapDesc")}</p>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {result.talent_map.map((item) => (
          <article key={item.direction} className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900">{item.direction}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
                {item.candidate_count} {resultCopy(locale, "people")}
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-blue-600">{item.fit}</p>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{item.rationale}</p>
          </article>
        ))}
      </div>
    </ResultSurface>
  );
}

export function EvidenceCoverageView({ result, locale }: { result: TalentSearchResult } & ResultLocaleProps) {
  const coverage = buildEvidenceCoverage(result) as EvidenceCoverageGroup[];
  if (coverage.every((item) => item.count === 0)) return null;
  const covered = coverage.filter((item) => item.status === "covered").length;
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "evidenceCoverageTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">{resultCopy(locale, "evidenceCoverageDesc")}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {covered} / {coverage.length}
        </span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {coverage.map((item) => (
          <article key={item.key} className={`rounded-xl border p-4 ${item.status === "covered" ? "border-emerald-100 bg-emerald-50/50" : "border-amber-100 bg-amber-50/50"}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${item.status === "covered" ? "bg-white text-emerald-700 ring-emerald-200" : "bg-white text-amber-700 ring-amber-200"}`}>
                {item.count}
              </span>
            </div>
            {item.source_types.length > 0 ? (
              <p className="mt-2 text-xs leading-relaxed text-gray-600">{item.source_types.join(", ")}</p>
            ) : (
              <p className="mt-2 text-xs leading-relaxed text-amber-700">{resultCopy(locale, "missing")} {item.missing_source_types.slice(0, 2).join(", ")}</p>
            )}
          </article>
        ))}
      </div>
    </ResultSurface>
  );
}

export function CandidateComparisonView({ result, locale }: { result: unknown } & ResultLocaleProps) {
  const rows: CandidateComparisonRow[] = buildCandidateComparisonRows(result);
  if (rows.length === 0) return null;
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{resultCopy(locale, "comparisonTitle")}</h2>
          <p className="mt-1 text-sm text-gray-500">{resultCopy(locale, "comparisonDesc")}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {rows.length} 人
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-[960px] w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold text-gray-400">
              <th className="border-b border-gray-100 px-3 py-2">{resultCopy(locale, "candidates")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{resultCopy(locale, "direction")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{resultCopy(locale, "match")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{resultCopy(locale, "achievements")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{resultCopy(locale, "skills")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{resultCopy(locale, "workHistory")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{resultCopy(locale, "evidence")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{resultCopy(locale, "sourceTypes")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{resultCopy(locale, "signalRisk")}</th>
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
                    <span className="text-xs text-gray-400">{resultCopy(locale, "notIdentified")}</span>
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
                    <QualityPill value={row.evidence_quality} locale={locale} />
                  </div>
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{row.independent_sources}</p>
                  {row.source_types && <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{row.source_types}</p>}
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  {row.top_signal && <p className="text-xs leading-relaxed text-emerald-700">{row.top_signal}</p>}
                  {row.risk_summary && <p className="mt-1 text-xs leading-relaxed text-amber-700">{row.risk_summary}</p>}
                  {row.coverage_gaps && <p className="mt-1 text-xs leading-relaxed text-gray-500">{resultCopy(locale, "gapPrefix")}: {row.coverage_gaps}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ResultSurface>
  );
}

function evidencePriorityTone(priority: string) {
  if (priority === "risk_review") {
    return {
      chip: "bg-red-50 text-red-700 ring-red-200",
      card: "border-red-100 bg-red-50/45",
      dot: "bg-red-500",
    };
  }
  if (priority === "needs_backfill") {
    return {
      chip: "bg-amber-50 text-amber-700 ring-amber-200",
      card: "border-amber-100 bg-amber-50/45",
      dot: "bg-amber-500",
    };
  }
  return {
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    card: "border-emerald-100 bg-emerald-50/45",
    dot: "bg-emerald-500",
  };
}

function EvidencePrioritySummaryCard({
  label,
  value,
  priority,
}: {
  label: string;
  value: number;
  priority: string;
}) {
  const tone = evidencePriorityTone(priority);
  return (
    <div className={`rounded-2xl border px-3 py-3 ${tone.card}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
        <p className="text-xs font-semibold text-gray-700">{label}</p>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

function EvidencePriorityRow({
  item,
  onOpenCandidate,
  locale,
}: {
  item: EvidencePriorityItemView;
  onOpenCandidate?: (item: EvidencePriorityItemView) => void;
} & ResultLocaleProps) {
  const tone = evidencePriorityTone(item.priority);
  return (
    <li className={`rounded-2xl border p-4 ${tone.card}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900">{item.name}</p>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${tone.chip}`}>
              {item.priority_label}
            </span>
          </div>
          {item.role && <p className="mt-1 text-xs leading-5 text-gray-500">{item.role}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-700 ring-1 ring-black/10">
            {uiCopy(locale, "evidencePriority.match")} {item.match_score}
          </span>
          <QualityPill value={item.evidence_quality} locale={locale} />
        </div>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-[160px_minmax(0,1fr)]">
        <p className="font-semibold text-gray-800">{item.independent_sources} {uiCopy(locale, "evidencePriority.sources")}</p>
        <p>{uiCopy(locale, "evidencePriority.claims", { verified: item.verified_count, unverified: item.unverified_count, contradicted: item.contradicted_count })}</p>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-700">{item.priority_reason}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-gray-600">{item.recommended_action}</p>
        {onOpenCandidate && (
          <button
            type="button"
            onClick={() => onOpenCandidate(item)}
            aria-label={uiCopy(locale, "evidencePriority.openCandidate", { name: item.name })}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 ring-1 ring-black/10 transition hover:bg-gray-50"
          >
            {uiCopy(locale, "evidencePriority.open")}
          </button>
        )}
      </div>
    </li>
  );
}

export function EvidencePriorityPanel({
  view,
  onOpenCandidate,
  compact = false,
  locale,
}: {
  view: EvidencePriorityViewModel;
  onOpenCandidate?: (item: EvidencePriorityItemView) => void;
  compact?: boolean;
} & ResultLocaleProps) {
  if (!view || view.empty) return null;
  const visibleItems = view.items.slice(0, compact ? 4 : 6);
  return (
    <ResultSurface>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{uiCopy(locale, "evidencePriority.title")}</h2>
          <p className="mt-1 text-sm text-gray-500">{uiCopy(locale, compact ? "evidencePriority.compactDesc" : "evidencePriority.desc")}</p>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <EvidencePrioritySummaryCard label={uiCopy(locale, "evidencePriority.ready_to_review.label")} value={view.summary.ready_to_review} priority="ready_to_review" />
        <EvidencePrioritySummaryCard label={uiCopy(locale, "evidencePriority.needs_backfill.label")} value={view.summary.needs_backfill} priority="needs_backfill" />
        <EvidencePrioritySummaryCard label={uiCopy(locale, "evidencePriority.risk_review.label")} value={view.summary.risk_review} priority="risk_review" />
      </div>
      <ul className="mt-4 grid gap-3">
        {visibleItems.map((item) => (
          <EvidencePriorityRow key={`${item.priority}-${item.candidate_index}-${item.name}`} item={item} onOpenCandidate={onOpenCandidate} locale={locale} />
        ))}
      </ul>
    </ResultSurface>
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
  locale,
}: {
  candidate: TalentCandidate;
  selected: boolean;
  onToggle?: () => void;
  onOpen?: () => void;
} & ResultLocaleProps) {
  const uncertainty = candidate.uncertainties[0];
  const topSignals = candidate.strongest_signals.slice(0, 3);

  return (
    <article className="rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
      <div className="flex items-start gap-3">
        <ScorePill score={candidate.match_score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900">{candidate.name}</h3>
            <QualityPill value={candidate.evidence_audit.overall_evidence_quality} locale={locale} />
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
            <li key={signal} className="flex gap-2 text-sm leading-relaxed text-gray-700">
              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {signal}
            </li>
          ))}
        </ul>
      )}

      {uncertainty && (
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-700 ring-1 ring-amber-100">
          {uncertainty}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={onOpen}
          disabled={!onOpen}
          className="rounded-full bg-[var(--sh-ink)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {resultCopy(locale, "viewDetails")}
        </button>
        <button
          type="button"
          onClick={onToggle}
          disabled={!onToggle}
          className={`rounded-full px-3.5 py-2 text-sm font-semibold ring-1 transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:ring-gray-200 ${
            selected
              ? "bg-red-50 text-red-700 ring-red-200 hover:bg-red-100"
              : "bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100"
          }`}
        >
          {selected ? resultCopy(locale, "removeFromPool") : resultCopy(locale, "addToPool")}
        </button>
      </div>
    </article>
  );
}

function AuditStat({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "red" | "gray" }) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    gray: "bg-gray-50 text-gray-700 ring-gray-100",
  }[tone];
  return (
    <div className={`rounded-2xl p-3 ring-1 ${toneClass}`}>
      <p className="text-xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs font-medium">{label}</p>
    </div>
  );
}

function AuditItemList({ label, items, chip, locale }: { label: string; items: string[]; chip: string } & ResultLocaleProps) {
  return (
    <div>
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${chip}`}>
        {label}
      </span>
      {items.length > 0 ? (
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-600">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-1.5 text-sm text-gray-400">{resultCopy(locale, "none")}</p>
      )}
    </div>
  );
}

export function EvidenceAuditView({ candidate, result, locale }: { candidate: TalentCandidate; result?: TalentSearchResult } & ResultLocaleProps) {
  const audit: CandidateEvidenceAuditSummary = buildCandidateEvidenceAudit({ result, candidate });
  const rows = [
    { label: resultCopy(locale, "verified"), items: audit.verified_claims, chip: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    { label: resultCopy(locale, "unverified"), items: audit.unverified_claims, chip: "bg-amber-50 text-amber-700 ring-amber-200" },
    { label: resultCopy(locale, "contradicted"), items: audit.contradicted_claims, chip: "bg-red-50 text-red-700 ring-red-200" },
    { label: resultCopy(locale, "singleSourceClaims"), items: audit.single_source_claims, chip: "bg-blue-50 text-blue-700 ring-blue-200" },
    { label: resultCopy(locale, "identityRisk"), items: audit.identity_risks, chip: "bg-red-50 text-red-700 ring-red-200" },
    { label: resultCopy(locale, "recencyNotes"), items: audit.recency_notes, chip: "bg-gray-50 text-gray-700 ring-gray-200" },
  ];

  return (
    <section className="rounded-2xl border border-black/10 bg-white/72 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">{resultCopy(locale, "auditTitle")}</h4>
        <div className="flex flex-wrap items-center gap-2">
          {audit.independent_sources > 0 && (
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
              {resultCopy(locale, "independentSources", { count: audit.independent_sources })}
            </span>
          )}
          <QualityPill value={audit.overall_evidence_quality} locale={locale} />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <AuditStat label={resultCopy(locale, "verified")} value={audit.verified_count} tone="emerald" />
        <AuditStat label={resultCopy(locale, "unverified")} value={audit.unverified_count} tone="amber" />
        <AuditStat label={resultCopy(locale, "contradicted")} value={audit.contradicted_count} tone="red" />
        <AuditStat label={resultCopy(locale, "singleSourceClaims")} value={audit.single_source_claims.length} tone="gray" />
      </div>
      {audit.source_types.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {audit.source_types.map((type) => (
            <span key={type} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              {type}
            </span>
          ))}
        </div>
      )}
      {audit.cross_validation && (
        <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm leading-relaxed text-gray-700 ring-1 ring-gray-100">
          {audit.cross_validation}
        </p>
      )}
      <div className="mt-3 space-y-3">
        {rows.map((row) => <AuditItemList key={row.label} {...row} locale={locale} />)}
        {audit.strongest_evidence.length > 0 && (
          <AuditItemList label={resultCopy(locale, "strongestEvidence")} items={audit.strongest_evidence} chip="bg-emerald-50 text-emerald-700 ring-emerald-200" locale={locale} />
        )}
        {audit.weakest_evidence.length > 0 && (
          <AuditItemList label={resultCopy(locale, "weakEvidence")} items={audit.weakest_evidence} chip="bg-amber-50 text-amber-700 ring-amber-200" locale={locale} />
        )}
        {audit.risk_flags.length > 0 && (
          <AuditItemList label={resultCopy(locale, "riskFlags")} items={audit.risk_flags} chip="bg-red-50 text-red-700 ring-red-200" locale={locale} />
        )}
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

function CandidateReadingSummaryView({ summary }: { summary: CandidateReadingSummary }) {
  return (
    <section className="mt-5 rounded-2xl border border-black/10 bg-white/82 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{summary.title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {summary.sections.map((section) => (
          <div key={section.key} className="rounded-xl bg-[var(--sh-canvas)] px-3 py-3 ring-1 ring-black/5">
            <p className="text-sm font-semibold text-gray-900">{section.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-700">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function EvidenceGraphView({ result, candidate, locale }: { result: TalentSearchResult; candidate: TalentCandidate } & ResultLocaleProps) {
  const graph = result.evidence_graph;
  if (!graph) return null;
  const node = graph.candidates.find((item) => item.candidate_name === candidate.name);
  if (!node && !graph.summary && graph.source_mix.length === 0) return null;
  return (
    <section className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">{resultCopy(locale, "evidenceGraph")}</h4>
        {node && (
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-gray-600 ring-1 ring-gray-200">
            {resultCopy(locale, "independentSources", { count: node.independent_sources })}
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
      {node?.strongest_evidence.length ? <EvidenceList title={resultCopy(locale, "strongestEvidence")} items={node.strongest_evidence} tone="emerald" /> : null}
      {node?.weakest_evidence.length ? <EvidenceList title={resultCopy(locale, "weakEvidence")} items={node.weakest_evidence} tone="amber" /> : null}
      {node?.risk_flags.length ? <EvidenceList title={resultCopy(locale, "risk")} items={node.risk_flags} tone="red" /> : null}
    </section>
  );
}

function CandidateEvidenceDossierView({
  dossier,
  onBackfillJob,
  backfillDisabled = false,
  locale,
}: {
  dossier: CandidateEvidenceDossier;
  onBackfillJob?: (job: CoverageBackfillJob) => void;
  backfillDisabled?: boolean;
} & ResultLocaleProps) {
  return (
    <section className="mt-5 rounded-2xl border border-black/10 bg-[var(--sh-faint)]/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{dossier.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-900">{dossier.conclusion}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {dossier.metrics.map((metric) => (
            <div key={metric.label} className="min-w-[74px] rounded-2xl bg-white/80 px-3 py-2 text-center ring-1 ring-black/5">
              <p className="text-sm font-semibold text-gray-900">{metric.value}</p>
              <p className="mt-0.5 text-[11px] font-medium leading-tight text-gray-500">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {dossier.source_types.map((type) => (
          <span key={type} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
            {type}
          </span>
        ))}
      </div>

      {dossier.backfill_delta && (
        <div className="mt-4 rounded-xl bg-emerald-50/80 px-3 py-3 ring-1 ring-emerald-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-emerald-900">{dossier.backfill_delta.title}</p>
              <p className="mt-0.5 text-xs text-emerald-800/70">{resultCopy(locale, "candidateBackfillMerged")}</p>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
              {resultCopy(locale, "newEvidence", { count: dossier.backfill_delta.new_evidence_count })}
            </span>
          </div>
          {dossier.backfill_delta.merge_note && (
            <p className="mt-2 text-sm leading-relaxed text-emerald-950">{dossier.backfill_delta.merge_note}</p>
          )}
          {dossier.backfill_delta.new_source_types.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {dossier.backfill_delta.new_source_types.map((type) => (
                <span key={type} className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                  {type}
                </span>
              ))}
            </div>
          )}
          {dossier.backfill_delta.new_evidence_urls.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs leading-relaxed text-emerald-900/80">
              {dossier.backfill_delta.new_evidence_urls.slice(0, 3).map((url) => (
                <li key={url} className="truncate">
                  <a className="hover:text-emerald-950 hover:underline" href={url} target="_blank" rel="noreferrer">
                    {host(url, locale)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {dossier.evidence_groups.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">{resultCopy(locale, "dossierCoverage")}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {dossier.evidence_groups.map((group) => {
              const covered = group.status === "covered";
              return (
                <div key={group.key} className={`rounded-xl px-3 py-2 ring-1 ${covered ? "bg-white/80 ring-black/5" : "bg-amber-50/70 ring-amber-100"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900">{group.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${covered ? "bg-emerald-50 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                      {covered ? resultCopy(locale, "evidence") : resultCopy(locale, "missing")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {group.source_types.length > 0 ? group.source_types.join(", ") : group.missing_source_types.join(", ")}
                  </p>
                  {group.primary_claims.length > 0 && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-700">{group.primary_claims.join(" / ")}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 grid gap-2 md:grid-cols-[1.2fr_0.8fr]">
        <p className="rounded-xl bg-white/78 px-3 py-2 text-sm leading-relaxed text-gray-700 ring-1 ring-black/5">
          {dossier.verdict_summary}
        </p>
        <p className="rounded-xl bg-white/78 px-3 py-2 text-sm leading-relaxed text-amber-800 ring-1 ring-amber-100">
          {dossier.risk_summary}
        </p>
      </div>

      {dossier.primary_evidence.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {dossier.primary_evidence.map((item) => (
            <li key={item} className="flex gap-2 text-sm leading-relaxed text-gray-700">
              <FiCheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      )}

      {(dossier.backfill_jobs.length > 0 || dossier.verification_gaps.length > 0) && (
        <div className="mt-3 rounded-xl bg-amber-50/80 px-3 py-2 ring-1 ring-amber-100">
          <p className="text-xs font-semibold text-amber-800">{resultCopy(locale, "verificationGaps")}</p>
          <ul className="mt-1 space-y-1">
            {dossier.backfill_jobs.length > 0 ? dossier.backfill_jobs.map((job) => (
              <li key={job.gap_id} className="flex flex-wrap items-center justify-between gap-2 text-sm leading-relaxed text-amber-900">
                <span className="flex min-w-0 flex-1 gap-2">
                  <FiFlag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>{job.reason}</span>
                </span>
                {onBackfillJob && (
                  <button
                    type="button"
                    onClick={() => onBackfillJob(job)}
                    disabled={backfillDisabled || job.status !== "planned"}
                    className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {backfillDisabled ? resultCopy(locale, "enqueueingBackfill") : resultCopy(locale, "backfillGap")}
                  </button>
                )}
              </li>
            )) : dossier.verification_gaps.map((gap) => (
              <li key={gap} className="flex gap-2 text-sm leading-relaxed text-amber-900">
                <FiFlag className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                {gap}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function CandidateProfileView({
  candidate,
  result,
  onBackfillJob,
  backfillDisabled = false,
  locale,
}: {
  candidate: TalentCandidate;
  result?: TalentSearchResult;
  onBackfillJob?: (job: CoverageBackfillJob) => void;
  backfillDisabled?: boolean;
} & ResultLocaleProps) {
  const readingSummary = buildCandidateReadingSummary({ result, candidate, locale: locale ?? "zh" }) as CandidateReadingSummary;
  const dossier = buildCandidateEvidenceDossier({ result, candidate, locale: locale ?? "zh" }) as CandidateEvidenceDossier;

  return (
    <article className="rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
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

      <CandidateReadingSummaryView summary={readingSummary} />

      <CandidateEvidenceDossierView dossier={dossier} onBackfillJob={onBackfillJob} backfillDisabled={backfillDisabled} locale={locale} />

      {candidate.outreach_angle && (
        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4">
          <p className="text-sm font-semibold text-blue-700">{resultCopy(locale, "outreachAngle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-blue-900">{candidate.outreach_angle}</p>
        </div>
      )}

      <div className="mt-4">
        <EvidenceAuditView candidate={candidate} result={result} locale={locale} />
      </div>

      {candidate.claims.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {candidate.claims.map((claim, i) => <ClaimBlock key={i} c={claim} locale={locale} />)}
        </div>
      )}
    </article>
  );
}

export function CandidateCard({ c, delay = 0, locale }: { c: Candidate; delay?: number } & ResultLocaleProps) {
  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className="sh-fade-in-up rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{c.headline}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {c.links?.github && <LinkPill href={c.links.github}>GitHub</LinkPill>}
          {c.links?.linkedin && <LinkPill href={c.links.linkedin}>LinkedIn</LinkPill>}
          {c.links?.other && <LinkPill href={c.links.other}>{resultCopy(locale, "homepage")}</LinkPill>}
        </div>
      </div>
      {c.claims?.length > 0 && <div className="mt-3"><Tally claims={c.claims} locale={locale} /></div>}
      <div className="mt-3 space-y-2.5">
        {c.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} locale={locale} />)}
      </div>
      <p className="mt-4 border-t border-gray-100 pt-3 text-sm italic text-gray-500">{c.summary}</p>
    </article>
  );
}

// 可信度环形大徽章
function TrustRing({ level, locale }: { level: "high" | "medium" | "low" } & ResultLocaleProps) {
  const meta = {
    high: { label: resultCopy(locale, "high"), ring: "ring-emerald-200 text-emerald-700 bg-emerald-50", pct: 92, stroke: "#10b981" },
    medium: { label: resultCopy(locale, "medium"), ring: "ring-amber-200 text-amber-700 bg-amber-50", pct: 58, stroke: "#f59e0b" },
    low: { label: resultCopy(locale, "low"), ring: "ring-red-200 text-red-700 bg-red-50", pct: 24, stroke: "#ef4444" },
  }[level] ?? { label: resultCopy(locale, "low"), ring: "ring-red-200 text-red-700 bg-red-50", pct: 24, stroke: "#ef4444" };
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg className="absolute -rotate-90" width="80" height="80" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eee" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={meta.stroke} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - meta.pct / 100)} />
      </svg>
      <div className="text-center">
        <div className="text-[9px] font-medium text-gray-400">{resultCopy(locale, "trust")}</div>
        <div className={`text-xl font-bold leading-none ${level === "high" ? "text-emerald-600" : level === "medium" ? "text-amber-600" : "text-red-600"}`}>{meta.label}</div>
      </div>
    </div>
  );
}

export function TrustReportView({ r, locale }: { r: VerifyReport } & ResultLocaleProps) {
  const totalSources = reportUniqueSources(r.claims);
  const heuristic = trustHeuristic(r, locale);
  return (
    <article className="sh-fade-in-up rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{r.candidate_name}</h3>
          {r.claims?.length > 0 && <div className="mt-2"><Tally claims={r.claims} locale={locale} /></div>}
        </div>
        <TrustRing level={r.overall_trust} locale={locale} />
      </div>

      {/* 信源汇总 + 启发式信任度 (Phase 2.A.1 透明度增强) */}
      {r.claims?.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2 text-xs text-gray-600">
          <span className="font-medium text-gray-700">{resultCopy(locale, "reportBasedOn", { count: totalSources })}</span>
          <span className="text-gray-300">·</span>
          <span title={heuristic.hint} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ring-1 ${trustHeuristicChip(heuristic.level)}`}>
            {heuristic.label}
          </span>
          <span className="text-gray-400">- {heuristic.hint}</span>
        </div>
      )}

      <div className="mt-4 space-y-2.5">
        {r.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} locale={locale} />)}
      </div>
      {r.red_flags?.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/60 p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-red-700">
            <FiFlag className="h-4 w-4" aria-hidden="true" />
            {resultCopy(locale, "redFlags")}
          </p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-600/90">
            {r.red_flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {/* 自我披露 / 解读说明 (Phase 2.A.1) */}
      <details className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-3 text-xs text-gray-600">
        <summary className="cursor-pointer font-medium text-gray-700">
          <span className="inline-flex items-center gap-2">
            <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
            {resultCopy(locale, "reportCaveatTitle")}
          </span>
        </summary>
        <div className="mt-2 space-y-1.5 leading-relaxed">
          <p>{resultCopy(locale, "caveat1")}</p>
          <p>{resultCopy(locale, "caveat2")}</p>
          <p>{resultCopy(locale, "caveat3")}</p>
          <p>{resultCopy(locale, "caveat4")}</p>
          <p>{resultCopy(locale, "caveat5")}</p>
        </div>
      </details>
    </article>
  );
}
