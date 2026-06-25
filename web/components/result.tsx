// components/result.tsx —— 候选人/验证结果的展示组件 (纯展示, 无 hooks)。
// 同时被 app/page.tsx (客户端工具) 和 app/r/[id]/page.tsx (服务端可分享报告) 复用。

declare module "@/lib/talent-profile.mjs" {
  export type CandidateComparisonRow = import("@/lib/talent-profile").CandidateComparisonRow;
  export type CandidateReadingSummary = import("@/lib/talent-profile").CandidateReadingSummary;
  export type CandidateReviewBrief = import("@/lib/talent-profile").CandidateReviewBrief;
  export type CandidateProfileCacheEntry = import("@/lib/talent-profile").CandidateProfileCacheEntry;
  export type SimilarCandidateSuggestion = import("@/lib/talent-profile").SimilarCandidateSuggestion;
  export type CandidateEvidenceDossier = import("@/lib/talent-profile").CandidateEvidenceDossier;
  export type CandidateEvidenceMatrix = import("@/lib/talent-profile").CandidateEvidenceMatrix;
  export type BackfillMergeSummary = import("@/lib/talent-profile").BackfillMergeSummary;
  export type CoverageBackfillJob = import("@/lib/talent-profile").CoverageBackfillJob;
  export type CandidateEvidenceAuditSummary = import("@/lib/talent-profile").CandidateEvidenceAuditSummary;
  export type EvidenceCoverageGroup = import("@/lib/talent-profile").EvidenceCoverageGroup;
  export type ShortlistDeliveryReport = import("@/lib/talent-profile").ShortlistDeliveryReport;
  export type SourceExecutionJob = import("@/lib/talent-profile").SourceExecutionJob;
  export type SourceQueryPlanItem = import("@/lib/talent-profile").SourceQueryPlanItem;
  export type SearchResultWorkspace = import("@/lib/talent-profile").SearchResultWorkspace;
  export type TalentCandidate = import("@/lib/talent-profile").TalentCandidate;
  export type TalentSearchResult = import("@/lib/talent-profile").TalentSearchResult;
}

import type { BackfillMergeSummary, CandidateComparisonRow, CandidateEvidenceAuditSummary, CandidateEvidenceMatrix, CandidateProfileCacheEntry, CandidateReadingSummary, CandidateReviewBrief, CandidateEvidenceDossier, CoverageBackfillJob, EvidenceCoverageGroup, SearchResultWorkspace, ShortlistDeliveryReport, SimilarCandidateSuggestion, SourceExecutionJob, SourceQueryPlanItem, TalentCandidate, TalentSearchResult } from "@/lib/talent-profile.mjs";
import { buildCandidateComparisonRows, buildCandidateEvidenceAudit, buildCandidateEvidenceMatrix, buildCandidateProfileCacheEntry, buildCandidateReadingSummary, buildCandidateReviewBrief, buildCandidateEvidenceDossier, buildCoverageBackfillPlan, buildEvidenceCoverage, buildSearchResultWorkspace, buildShortlistDeliveryReport, buildSimilarCandidateSuggestions, buildSourceExecution, buildSourceQueryPlan } from "@/lib/talent-profile.mjs";
import type { IconType } from "react-icons";
import { FiCheckCircle, FiChevronDown, FiClock, FiExternalLink, FiFlag, FiHelpCircle, FiInfo, FiLink2, FiRefreshCw, FiShare2, FiUploadCloud, FiXCircle } from "react-icons/fi";
import { t as translate } from "@/lib/i18n.mjs";
import { buildRelatedTalentView, buildTalentIntelligenceReport } from "@/lib/talent-intelligence.mjs";
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
export type EducationCheckStatus =
  | "public_supported"
  | "public_partial"
  | "public_insufficient"
  | "inconsistent"
  | "needs_formal"
  | "formal_verified"
  | "materials_needed";
export type VerificationMethod =
  | "public_evidence_search"
  | "candidate_provided_verification"
  | "employer_ordered_verification"
  | "manual_hr_attestation";
export type Evidence = { note: string; url: string; source_type?: string };
export type Claim = {
  claim: string;
  verdict: Verdict;
  evidence: Evidence[];
  claim_category?: string;
  education_check_status?: EducationCheckStatus | string;
  verification_method?: VerificationMethod | string;
  source_confidence?: "high" | "medium" | "low" | "unknown" | string;
  missing_fields?: string[];
  recommended_next_action?: string;
};
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

type SharedResultCopyKey =
  | "unknownCandidate"
  | "source"
  | "verified"
  | "contradicted"
  | "unverified"
  | "sourceCountTitle"
  | "deliveryTitle"
  | "deliveryBadge"
  | "candidates"
  | "strongRecommendations"
  | "averageMatch"
  | "strongEvidenceCandidates"
  | "sourceCoverage"
  | "priorityReview"
  | "sourcesShort"
  | "deliveryRisks"
  | "nextSteps"
  | "searchPlanTitle"
  | "searchPlanDesc"
  | "notIdentified"
  | "sourceQueryPlan"
  | "items"
  | "adjacentPools"
  | "research"
  | "practice"
  | "work_history"
  | "public_voice"
  | "planned"
  | "completed"
  | "partial"
  | "failed"
  | "sourceExecutionTitle"
  | "sourceExecutionReturned"
  | "sourceExecutionPlanned"
  | "executed"
  | "evidence"
  | "links"
  | "leads"
  | "backfillTitle"
  | "backfillDesc"
  | "gaps"
  | "plannedBackfill"
  | "completedBackfill"
  | "skippedBackfill"
  | "affectedCandidates"
  | "prioritySources"
  | "enqueueingBackfill"
  | "backfillGap"
  | "backfillDeltaTitle"
  | "candidateBackfillMerged"
  | "merged"
  | "mergeable"
  | "newSources"
  | "newEvidence"
  | "backfillNewCandidates"
  | "mergedBack"
  | "merging"
  | "mergeBack"
  | "talentMapTitle"
  | "talentMapDesc"
  | "people"
  | "evidenceCoverageTitle"
  | "evidenceCoverageDesc"
  | "missing"
  | "comparisonTitle"
  | "comparisonDesc"
  | "direction"
  | "match"
  | "achievements"
  | "skills"
  | "workHistory"
  | "sourceTypes"
  | "signalRisk"
  | "gapPrefix"
  | "viewDetails"
  | "removeFromPool"
  | "addToPool"
  | "claim"
  | "auditTitle"
  | "dossierCoverage"
  | "verificationGaps"
  | "independentSources"
  | "singleSourceClaims"
  | "identityRisk"
  | "recencyNotes"
  | "none"
  | "strongestEvidence"
  | "weakEvidence"
  | "riskFlags"
  | "evidenceGraph"
  | "risk"
  | "evidenceStrong"
  | "evidenceMedium"
  | "evidenceWeak"
  | "outreachAngle"
  | "homepage"
  | "trust"
  | "high"
  | "medium"
  | "low"
  | "redFlags"
  | "reportBasedOn"
  | "reportCaveatTitle"
  | "caveat1"
  | "caveat2"
  | "caveat3"
  | "caveat4"
  | "caveat5";
type ResultCopyKey = SharedResultCopyKey;

function resultCopy(locale: Locale | undefined, key: ResultCopyKey, params: Record<string, string | number> = {}) {
  return uiCopy(locale, `result.${key}`, params);
}

// 裁决语义色 (与 DESIGN-SYSTEM.md 一致)
const VERDICT: Record<Verdict, { labelKey: "verified" | "contradicted" | "unverified"; Icon: IconType; chip: string; panel: string }> = {
  verified: { labelKey: "verified", Icon: FiCheckCircle, chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", panel: "border-emerald-100 bg-emerald-50/45" },
  contradicted: { labelKey: "contradicted", Icon: FiXCircle, chip: "bg-red-50 text-red-700 ring-red-200", panel: "border-red-100 bg-red-50/45" },
  unverified: { labelKey: "unverified", Icon: FiHelpCircle, chip: "bg-amber-50 text-amber-700 ring-amber-200", panel: "border-amber-100 bg-amber-50/45" },
};

const EDUCATION_STATUS: Record<string, { key: string; tone: string }> = {
  public_supported: { key: "public_supported", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  public_partial: { key: "public_partial", tone: "bg-sky-50 text-sky-700 ring-sky-200" },
  public_insufficient: { key: "public_insufficient", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  inconsistent: { key: "inconsistent", tone: "bg-red-50 text-red-700 ring-red-200" },
  needs_formal: { key: "needs_formal", tone: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  formal_verified: { key: "formal_verified", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  materials_needed: { key: "materials_needed", tone: "bg-gray-100 text-gray-700 ring-gray-200" },
};

function isEducationClaim(c: Claim): boolean {
  return c.claim_category === "education" || Boolean(c.education_check_status);
}

function educationStatusLabel(status: string | undefined, locale?: Locale): string {
  if (!status) return "";
  const meta = EDUCATION_STATUS[status];
  return meta ? uiCopy(locale, `result.education.${meta.key}`) : status;
}

function educationMethodLabel(method: string | undefined, locale?: Locale): string {
  if (!method) return "";
  const label = uiCopy(locale, `result.education.method.${method}`);
  return label === `result.education.method.${method}` ? method : label;
}

function supportingMaterialHref(c: Claim, locale?: Locale): string {
  const prefill = [
    uiCopy(locale, "research.supportingMaterialPrefillHeader"),
    "",
    c.claim,
    "",
    uiCopy(locale, "result.supportingMaterial.supplementPrefill"),
  ].join("\n");
  return `/app/verify?bio=${encodeURIComponent(prefill)}`;
}

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
  const educationStatus = educationStatusLabel(c.education_check_status, locale);
  const educationMethod = educationMethodLabel(c.verification_method, locale);
  const educationStatusTone = c.education_check_status ? EDUCATION_STATUS[c.education_check_status]?.tone : undefined;
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
      {isEducationClaim(c) && (
        <div className="mt-2.5 space-y-2 border-t border-black/5 pt-2.5">
          <div className="flex flex-wrap gap-1.5">
            {educationStatus && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${educationStatusTone ?? "bg-gray-100 text-gray-700 ring-gray-200"}`}>
                {educationStatus}
              </span>
            )}
            {educationMethod && (
              <span className="inline-flex items-center rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-gray-200">
                {educationMethod}
              </span>
            )}
          </div>
          {c.recommended_next_action && (
            <p className="flex gap-1.5 text-xs leading-relaxed text-gray-600">
              <FiInfo className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold text-gray-700">{uiCopy(locale, "result.education.nextAction")}：</span>
                {c.recommended_next_action}
              </span>
            </p>
          )}
          {Array.isArray(c.missing_fields) && c.missing_fields.length > 0 && (
            <p className="text-xs leading-relaxed text-gray-500">
              <span className="font-semibold text-gray-600">{uiCopy(locale, "result.education.missingFields")}：</span>
              {c.missing_fields.join(", ")}
            </p>
          )}
        </div>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-black/5">
        <p className="min-w-0 flex-1 text-xs leading-5 text-gray-600">{uiCopy(locale, "result.supportingMaterial.supplementHint")}</p>
        <a
          href={supportingMaterialHref(c, locale)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--sh-ink)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black"
        >
          <FiUploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
          {uiCopy(locale, "result.supportingMaterial.supplementAction")}
        </a>
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
  const report: ShortlistDeliveryReport = buildShortlistDeliveryReport(result, { locale });
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
        <PlanList title={uiCopy(locale, "research.plan.mustHave")} items={plan.must_have} tone="emerald" locale={locale} />
        <PlanList title={uiCopy(locale, "research.plan.niceToHave")} items={plan.nice_to_have} tone="blue" locale={locale} />
        <PlanList title={uiCopy(locale, "research.plan.exclusions")} items={plan.exclusions} tone="red" locale={locale} />
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
  const plan = buildCoverageBackfillPlan(result, { locale });
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
          {rows.length} {resultCopy(locale, "people")}
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
  onOpen,
  locale,
}: {
  candidate: TalentCandidate;
  selected: boolean;
  onOpen?: () => void;
} & ResultLocaleProps) {
  const uncertainty = candidate.uncertainties[0];
  const topSignal = candidate.strongest_signals[0] || candidate.summary || candidate.headline;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      aria-pressed={selected}
      className={`block w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-[var(--sh-ink)] bg-white shadow-sm"
          : "border-black/10 bg-white/82 hover:border-black/20 hover:bg-white"
      } disabled:cursor-default disabled:opacity-70`}
    >
      <div className="flex items-start gap-3">
        <ScorePill score={candidate.match_score} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-gray-900">{candidate.name}</h3>
            <QualityPill value={candidate.evidence_audit.overall_evidence_quality} locale={locale} />
          </div>
          {candidate.headline && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-700">{candidate.headline}</p>}
          <CandidateMeta candidate={candidate} />
        </div>
      </div>

      {candidate.ai_directions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.ai_directions.slice(0, 3).map((direction) => (
            <span key={direction} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
              {direction}
            </span>
          ))}
        </div>
      )}

      {topSignal && (
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-gray-700">
          {topSignal}
        </p>
      )}

      {uncertainty && (
        <p className="mt-3 line-clamp-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-700 ring-1 ring-amber-100">
          {uncertainty}
        </p>
      )}
    </button>
  );
}

type WorkspaceStats = { searches?: number; fetches?: number; durationSeconds?: number; duration_seconds?: number };

function workspaceUiCopy(locale: Locale | undefined, key: string) {
  const zh: Record<string, string> = {
    completionMeta: "完成态",
    candidatesFound: "候选人",
    highConfidence: "高可信候选人",
    needsVerification: "需核验证据",
    sourceCoverage: "来源覆盖",
    majorGaps: "主要证据缺口",
    noMajorGaps: "暂无主要缺口",
    claimCounts: "Claims",
    sourceTools: "来源任务",
    coverage: "证据覆盖",
    stats: "搜索统计",
    searches: "搜索",
    fetches: "抓取",
    seconds: "秒",
    submitted: "已提交",
    trace: "执行 trace",
    deliveryClusters: "交付分组",
    sourceMix: "来源组合",
    submittedVia: "已提交来源",
    listTitle: "候选人列表",
    listDesc: "按匹配度、证据质量和风险优先级审阅。",
    selected: "当前查看",
    sources: "来源",
    noSources: "暂无来源类型",
    matchContext: "匹配上下文",
    primaryRisk: "待确认 / 风险",
    drawerTitle: "候选人情报",
    shortlist: "加入候选池",
    shortlisted: "已加入候选池",
    draftOutreach: "起草外联",
    needEvidence: "需要补证据",
    pass: "暂不推进",
    researchLog: "Research Log",
    researchLogDesc: "默认折叠，保留可追溯的搜索计划和来源执行。",
    showProcess: "查看完整搜索过程",
    noticeTitle: "证据交付",
  };
  const en: Record<string, string> = {
    completionMeta: "Completion",
    candidatesFound: "Candidates",
    highConfidence: "High confidence",
    needsVerification: "Needs verification",
    sourceCoverage: "Source coverage",
    majorGaps: "Major gaps",
    noMajorGaps: "No major gaps",
    claimCounts: "Claims",
    sourceTools: "Source tasks",
    coverage: "Coverage",
    stats: "Stats",
    searches: "searches",
    fetches: "fetches",
    seconds: "sec",
    submitted: "Submitted",
    trace: "Execution trace",
    deliveryClusters: "Delivery clusters",
    sourceMix: "Source mix",
    submittedVia: "Submitted via",
    listTitle: "Candidate list",
    listDesc: "Review by fit, evidence quality, and risk priority.",
    selected: "Selected",
    sources: "Sources",
    noSources: "No source types yet",
    matchContext: "Match context",
    primaryRisk: "To verify / risk",
    drawerTitle: "Candidate intelligence",
    shortlist: "Shortlist",
    shortlisted: "Shortlisted",
    draftOutreach: "Draft outreach",
    needEvidence: "Need more evidence",
    pass: "Pass",
    researchLog: "Research Log",
    researchLogDesc: "Collapsed by default with traceable search plan and source execution.",
    showProcess: "View full search process",
    noticeTitle: "Evidence handoff",
  };
  return (locale === "en" ? en : zh)[key] ?? zh[key] ?? key;
}

function WorkspaceMetric({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="rounded-2xl bg-white/72 p-3 ring-1 ring-black/5">
      <p className="text-xl font-semibold leading-none text-[var(--sh-ink)]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[var(--sh-muted)]">{label}</p>
      {detail && <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{detail}</p>}
    </div>
  );
}

function WorkspaceQualityPill({ value, locale }: { value: string } & ResultLocaleProps) {
  return <QualityPill value={value} locale={locale} />;
}

function WorkspaceCandidateRow({
  row,
  selected,
  saved,
  decision,
  onOpen,
  locale,
}: {
  row: SearchResultWorkspace["candidates"][number];
  selected: boolean;
  saved: boolean;
  decision?: string;
  onOpen: () => void;
} & ResultLocaleProps) {
  const status = saved ? "shortlisted" : decision || row.bucket.replace("_", " ");
  const submission = row.submission;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-3 text-left transition ${
        selected ? "border-[var(--sh-ink)] bg-white shadow-sm" : "border-black/10 bg-white/78 hover:border-black/20 hover:bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--sh-canvas)] text-sm font-semibold text-[var(--sh-ink)] ring-1 ring-black/10">
          {row.initials}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--sh-ink)]">{row.name}</h3>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
              {row.match_score}%
            </span>
            <WorkspaceQualityPill value={row.evidence_quality} />
          </div>
          {row.role && <p className="mt-1 line-clamp-1 text-xs text-[var(--sh-muted)]">{row.role}</p>}
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--sh-ink)]">{row.match_reason}</p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-amber-800">{row.primary_risk}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-[var(--sh-canvas)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
              {row.independent_sources} sources
            </span>
            <span className="rounded-full bg-[var(--sh-canvas)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
              {status}
            </span>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
              V {row.claim_counts.verified} / U {row.claim_counts.unverified} / C {row.claim_counts.contradicted}
            </span>
            <span className="rounded-full bg-neutral-950 px-2 py-0.5 text-xs font-semibold text-white">
              {row.handoff_action.label}
            </span>
          </div>
          {submission && (
            <p className="mt-2 line-clamp-1 text-xs leading-5 text-[var(--sh-muted)]">
              {workspaceUiCopy(locale, "submittedVia")} {submission.source}: {submission.reason || row.match_reason}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function CandidateSourceLinks({ candidate, sourceTypes, locale }: { candidate: TalentCandidate; sourceTypes: string[] } & ResultLocaleProps) {
  const links = [
    ["GitHub", candidate.links.github],
    ["LinkedIn", candidate.links.linkedin],
    ["Scholar", candidate.links.scholar],
    ["Hugging Face", candidate.links.huggingface],
    [resultCopy(locale, "homepage"), candidate.links.website || candidate.links.other],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map(([label, href]) => <LinkPill key={`${label}-${href}`} href={href}>{label}</LinkPill>)}
      {links.length === 0 && sourceTypes.length === 0 && (
        <span className="rounded-full bg-[var(--sh-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--sh-muted)] ring-1 ring-black/10">
          {workspaceUiCopy(locale, "noSources")}
        </span>
      )}
      {sourceTypes.slice(0, 4).map((sourceType) => (
        <span key={sourceType} className="rounded-full bg-[var(--sh-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--sh-muted)] ring-1 ring-black/10">
          {sourceType}
        </span>
      ))}
    </div>
  );
}

export function SearchResultWorkspaceView({
  result,
  stats,
  selectedIndex,
  shortlist,
  decisions,
  loading,
  handoffNotice,
  onOpenCandidate,
  onAddToPool,
  onNeedEvidence,
  onPass,
  onOutreach,
  onShareEvidenceBrief,
  onShowProcess,
  locale,
}: {
  result: TalentSearchResult;
  stats?: WorkspaceStats | null;
  selectedIndex: number | null;
  shortlist: number[];
  decisions: Record<number, string>;
  loading: boolean;
  handoffNotice?: string;
  onOpenCandidate: (index: number) => void;
  onAddToPool: (index: number, candidate: TalentCandidate) => void;
  onNeedEvidence: (index: number, candidate: TalentCandidate, job?: CoverageBackfillJob) => void;
  onPass: (index: number) => void;
  onOutreach: () => void;
  onShareEvidenceBrief: (index: number, candidate: TalentCandidate) => void;
  onShowProcess: () => void;
} & ResultLocaleProps) {
  const workspace = buildSearchResultWorkspace(result, { locale, stats: stats ?? undefined }) as SearchResultWorkspace;
  const requestedIndex = selectedIndex ?? workspace.selected_candidate_index ?? 0;
  const safeSelectedIndex = Math.min(Math.max(0, requestedIndex), Math.max(0, result.candidates.length - 1));
  const selectedCandidate = result.candidates[safeSelectedIndex] ?? result.candidates[0];
  const selectedRow = workspace.candidates.find((row) => row.index === safeSelectedIndex) ?? workspace.candidates[0];
  if (!selectedCandidate || !selectedRow) return null;
  const saved = shortlist.includes(safeSelectedIndex);
  const highConfidenceCount = workspace.groups.find((group) => group.key === "high_confidence")?.count ?? 0;
  const needsVerificationCount = workspace.groups.find((group) => group.key === "needs_verification")?.count ?? 0;
  const missingCoverage = workspace.research_log.coverage.filter((group) => group.status === "missing");
  const majorGapLabel = missingCoverage.slice(0, 2).map((group) => group.label).join(" / ") || workspaceUiCopy(locale, "noMajorGaps");

  return (
    <section className="space-y-4">
      <ResultSurface>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-700">
              <FiCheckCircle aria-hidden="true" />
              {workspace.completion.label}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--sh-ink)]">{workspace.summary}</h2>
          </div>
          <button type="button" onClick={onShowProcess} className="sh-secondary-action shrink-0 px-4">
            <FiRefreshCw aria-hidden="true" />
            {workspaceUiCopy(locale, "showProcess")}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <WorkspaceMetric label={workspaceUiCopy(locale, "highConfidence")} value={highConfidenceCount} />
          <WorkspaceMetric label={workspaceUiCopy(locale, "needsVerification")} value={needsVerificationCount} />
          <WorkspaceMetric label={workspaceUiCopy(locale, "sourceCoverage")} value={`${workspace.completion.covered_group_count}/${workspace.completion.coverage_group_count}`} />
          <WorkspaceMetric label={workspaceUiCopy(locale, "majorGaps")} value={missingCoverage.length} detail={majorGapLabel} />
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.45fr)]">
          {workspace.delivery_clusters.length > 0 && (
            <div className="rounded-2xl bg-white/72 p-3 ring-1 ring-black/5">
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{workspaceUiCopy(locale, "deliveryClusters")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {workspace.delivery_clusters.map((cluster) => (
                  <span key={cluster.key} className="rounded-full bg-[var(--sh-canvas)] px-2.5 py-1 text-xs font-semibold text-[var(--sh-ink)] ring-1 ring-black/10">
                    {cluster.label} {cluster.candidate_indices.length}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl bg-white/72 p-3 ring-1 ring-black/5">
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{workspaceUiCopy(locale, "sourceMix")}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--sh-ink)]">
              {workspace.agent_execution.telemetry.source_mix.slice(0, 5).map((item) => `${item.source_type} ${item.count}`).join(" / ") || `${workspace.completion.searches} ${workspaceUiCopy(locale, "searches")} / ${workspace.completion.fetches} ${workspaceUiCopy(locale, "fetches")}`}
            </p>
            {workspace.completion.duration_seconds > 0 && (
              <p className="mt-1 text-xs text-[var(--sh-muted)]">{workspace.completion.duration_seconds}{workspaceUiCopy(locale, "seconds")}</p>
            )}
          </div>
        </div>
      </ResultSurface>

      <section className="grid gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          <div className="rounded-2xl border border-black/10 bg-white/82 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--sh-ink)]">{workspaceUiCopy(locale, "listTitle")}</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{workspaceUiCopy(locale, "listDesc")}</p>
              </div>
              <span className="rounded-full bg-[var(--sh-canvas)] px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
                {workspace.groups.map((group) => `${group.label} ${group.count}`).join(" / ")}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {workspace.groups.map((group) => {
              const rows = group.candidate_indices
                .map((index) => workspace.candidates.find((row) => row.index === index))
                .filter((row): row is SearchResultWorkspace["candidates"][number] => Boolean(row));
              return (
                <section key={group.key} className="rounded-2xl border border-black/10 bg-white/70 p-3">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--sh-ink)]">{group.label}</h3>
                      <p className="mt-0.5 text-xs leading-5 text-[var(--sh-muted)]">{group.description}</p>
                    </div>
                    <span className="rounded-full bg-[var(--sh-canvas)] px-2 py-0.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
                      {group.count}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {rows.map((row) => (
                      <WorkspaceCandidateRow
                        key={`${row.name}-${row.index}`}
                        row={row}
                        selected={row.index === safeSelectedIndex}
                        saved={shortlist.includes(row.index)}
                        decision={decisions[row.index]}
                        onOpen={() => onOpenCandidate(row.index)}
                        locale={locale}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-[24px] border border-black/10 bg-white/88 p-4 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--sh-muted)]">{workspaceUiCopy(locale, "drawerTitle")}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--sh-canvas)] text-base font-semibold text-[var(--sh-ink)] ring-1 ring-black/10">
                    {selectedRow.initials}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold text-[var(--sh-ink)]">{selectedRow.name}</h2>
                    {selectedRow.role && <p className="mt-1 text-sm leading-5 text-[var(--sh-muted)]">{selectedRow.role}</p>}
                  </div>
                </div>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                {selectedRow.match_score}%
              </span>
            </div>

            <div className="mt-4">
              <CandidateSourceLinks candidate={selectedCandidate} sourceTypes={selectedRow.source_types} locale={locale} />
            </div>

            <div className="mt-4 rounded-2xl bg-[var(--sh-canvas)] p-3">
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{workspaceUiCopy(locale, "matchContext")}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--sh-ink)]">{selectedRow.match_reason}</p>
            </div>
            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 p-3">
              <p className="text-xs font-semibold text-amber-800">{workspaceUiCopy(locale, "primaryRisk")}</p>
              <p className="mt-1 text-sm leading-6 text-amber-950">{selectedRow.primary_risk}</p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onShareEvidenceBrief(safeSelectedIndex, selectedCandidate)}
                disabled={!selectedRow.handoff_action.enabled}
                title={selectedRow.handoff_action.reason}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--sh-ink)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiShare2 aria-hidden="true" />
                {selectedRow.handoff_action.label}
              </button>
              <button
                type="button"
                onClick={() => onAddToPool(safeSelectedIndex, selectedCandidate)}
                disabled={saved}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--sh-ink)] ring-1 ring-black/10 transition hover:bg-neutral-50 disabled:cursor-default disabled:bg-gray-100 disabled:text-gray-400"
              >
                {saved ? workspaceUiCopy(locale, "shortlisted") : workspaceUiCopy(locale, "shortlist")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onOpenCandidate(safeSelectedIndex);
                  onOutreach();
                }}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--sh-ink)] ring-1 ring-black/10 transition hover:bg-neutral-50"
              >
                {workspaceUiCopy(locale, "draftOutreach")}
              </button>
              <button
                type="button"
                onClick={() => onNeedEvidence(safeSelectedIndex, selectedCandidate)}
                disabled={loading}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {workspaceUiCopy(locale, "needEvidence")}
              </button>
              <button
                type="button"
                onClick={() => onPass(safeSelectedIndex)}
                className="inline-flex min-h-10 items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--sh-muted)] ring-1 ring-black/10 transition hover:bg-neutral-50 sm:col-span-2"
              >
                {workspaceUiCopy(locale, "pass")}
              </button>
            </div>
            {handoffNotice && (
              <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-3 text-sm leading-6 text-blue-900">
                <p className="font-semibold">{workspaceUiCopy(locale, "noticeTitle")}</p>
                <p className="mt-1">{handoffNotice}</p>
              </div>
            )}
          </div>

          <CandidateProfileView
            candidate={selectedCandidate}
            result={result}
            onBackfillJob={(job) => onNeedEvidence(safeSelectedIndex, selectedCandidate, job)}
            backfillDisabled={loading}
            locale={locale}
          />
        </aside>
      </section>

      <details className="group rounded-2xl border border-black/10 bg-white/78 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--sh-ink)]">
          <span className="inline-flex items-center gap-2">
            <FiClock aria-hidden="true" />
            {workspaceUiCopy(locale, "researchLog")}
          </span>
          <FiChevronDown className="transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{workspace.research_log.summary || workspaceUiCopy(locale, "researchLogDesc")}</p>
        <div className="mt-4 space-y-4">
          <SearchPlanView result={result} locale={locale} />
          <SourceExecutionView result={result} locale={locale} />
          <CoverageBackfillView result={result} locale={locale} />
          <EvidenceCoverageView result={result} locale={locale} />
          <TalentMapView result={result} locale={locale} />
          <CandidateComparisonView result={result} locale={locale} />
        </div>
        {workspace.research_log.execution_trace.length > 0 && (
          <div className="mt-3 grid gap-2">
            {workspace.research_log.execution_trace.slice(0, 8).map((trace) => (
              <div key={trace.trace_id} className="rounded-xl bg-[var(--sh-canvas)] p-3 text-xs leading-5 text-[var(--sh-muted)] ring-1 ring-black/5">
                <span className="font-semibold text-[var(--sh-ink)]">{trace.tool}</span>
                <span> · {trace.status}</span>
                <span> · {trace.candidates_found} candidates / {trace.evidence_found} evidence</span>
                {trace.query && <p className="mt-1 break-words font-mono">{trace.query}</p>}
                {trace.note && <p className="mt-1">{trace.note}</p>}
              </div>
            ))}
          </div>
        )}
      </details>
    </section>
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

function CandidateEvidenceMatrixView({ matrix, locale }: { matrix: CandidateEvidenceMatrix } & ResultLocaleProps) {
  if (matrix.empty) return null;
  return (
    <div className="mt-4 rounded-xl bg-white/78 p-3 ring-1 ring-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{matrix.title}</p>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-500">{matrix.description}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["verified", "unverified", "contradicted"] as Verdict[]).map((verdict) => {
            const count = matrix.summary[verdict];
            if (!count) return null;
            return (
              <span key={verdict} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${VERDICT[verdict].chip}`}>
                {count} {resultCopy(locale, VERDICT[verdict].labelKey)}
              </span>
            );
          })}
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-[720px] w-full border-separate border-spacing-0 text-left text-xs">
          <thead>
            <tr className="text-gray-500">
              <th className="border-b border-black/10 px-2 py-2 font-semibold">{resultCopy(locale, "claim")}</th>
              <th className="border-b border-black/10 px-2 py-2 font-semibold">{resultCopy(locale, "verified")}</th>
              <th className="border-b border-black/10 px-2 py-2 font-semibold">{resultCopy(locale, "source")}</th>
              <th className="border-b border-black/10 px-2 py-2 font-semibold">{resultCopy(locale, "risk")}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.key} className="align-top">
                <td className="border-b border-black/5 px-2 py-2 text-sm leading-relaxed text-gray-900">{row.claim}</td>
                <td className="border-b border-black/5 px-2 py-2">
                  <VerdictBadge v={row.verdict} locale={locale} />
                </td>
                <td className="border-b border-black/5 px-2 py-2">
                  {row.sources.length > 0 ? (
                    <div className="space-y-1.5">
                      {row.sources.slice(0, 3).map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center gap-1.5 text-blue-700 hover:underline"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={favicon(source.url)} alt="" width={12} height={12} className="rounded-sm" />
                          <span className="truncate">{source.host || host(source.url, locale)}</span>
                          <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-100">
                            {source.source_type}
                          </span>
                        </a>
                      ))}
                      {row.sources.length > 3 && (
                        <span className="text-[11px] font-medium text-gray-500">+{row.sources.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">{resultCopy(locale, "none")}</span>
                  )}
                </td>
                <td className="border-b border-black/5 px-2 py-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-gray-200">
                    {row.risk_label}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CandidateEvidenceDossierView({
  dossier,
  matrix,
  onBackfillJob,
  backfillDisabled = false,
  locale,
}: {
  dossier: CandidateEvidenceDossier;
  matrix: CandidateEvidenceMatrix;
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

      <CandidateEvidenceMatrixView matrix={matrix} locale={locale} />

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

export function CandidateReviewBriefView({ brief }: { brief: CandidateReviewBrief }) {
  return (
    <section className="mt-4 rounded-2xl border border-black/10 bg-[var(--sh-canvas)] p-4">
      <p className="text-sm font-semibold text-gray-900">{brief.title}</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {brief.sections.map((section) => (
          <div key={section.key} className="rounded-xl bg-white/80 p-3 ring-1 ring-black/5">
            <p className="text-xs font-semibold text-gray-500">{section.label}</p>
            <p className="mt-1 text-sm leading-relaxed text-gray-800">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function verticalProfileCopy(locale: Locale | undefined, key: "title" | "sources" | "confidence" | "similar" | "noSimilar") {
  const copy = {
    zh: {
      title: "AI 垂直画像",
      sources: "可缓存来源",
      confidence: "证据可信度",
      similar: "相似候选人",
      noSimilar: "暂无相似候选人建议",
    },
    en: {
      title: "AI vertical profile",
      sources: "Cacheable sources",
      confidence: "Evidence confidence",
      similar: "Similar candidates",
      noSimilar: "No similar candidate suggestions yet",
    },
  };
  return copy[locale === "en" ? "en" : "zh"][key];
}

function verticalQualityLabel(value: string, locale: Locale | undefined) {
  if (value === "high") return resultCopy(locale, "evidenceStrong");
  if (value === "low") return resultCopy(locale, "evidenceWeak");
  return resultCopy(locale, "evidenceMedium");
}

export function AIVerticalProfileView({
  result,
  candidate,
  locale,
}: {
  result?: TalentSearchResult;
  candidate: TalentCandidate;
} & ResultLocaleProps) {
  const cacheEntry = buildCandidateProfileCacheEntry({ result, candidate }) as CandidateProfileCacheEntry;
  const similar = buildSimilarCandidateSuggestions({ result, candidate, limit: 3 }) as SimilarCandidateSuggestion[];
  const sourceText = cacheEntry.source_types.length > 0 ? cacheEntry.source_types.join(", ") : resultCopy(locale, "none");

  return (
    <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/55 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-950">{verticalProfileCopy(locale, "title")}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {cacheEntry.vertical_tags.map((tag) => (
              <span key={tag} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-800 ring-1 ring-blue-100">
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div className="text-right text-xs leading-5 text-blue-900/75">
          <p><span className="font-semibold">{verticalProfileCopy(locale, "confidence")}:</span> {verticalQualityLabel(cacheEntry.confidence, locale)}</p>
          <p><span className="font-semibold">{verticalProfileCopy(locale, "sources")}:</span> {sourceText}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-white/72 p-3 ring-1 ring-blue-100">
        <p className="text-xs font-semibold text-blue-950">{verticalProfileCopy(locale, "similar")}</p>
        {similar.length > 0 ? (
          <div className="mt-2 space-y-2">
            {similar.map((item) => (
              <div key={item.name} className="flex flex-wrap items-center justify-between gap-2 text-sm text-blue-950">
                <span className="font-medium">{item.name}</span>
                <span className="text-xs text-blue-800/70">{item.shared_vertical_tags.join(", ") || item.shared_directions.join(", ")}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-blue-900/70">{verticalProfileCopy(locale, "noSimilar")}</p>
        )}
      </div>
    </section>
  );
}

function TalentIntelligencePanel({
  report,
  related,
  locale,
}: {
  report: {
    evidence_quality: string;
    audit: { verified_count: number; unverified_count: number; contradicted_count: number; independent_sources: number };
    sections: Array<{ key: string; title: string; evidence_count: number; summary: string }>;
    next_actions: string[];
  };
  related: {
    items: Array<{ name: string; role: string; relation_reason: string; evidence_urls: string[] }>;
    generated_search_brief: string;
  };
  locale: Locale;
}) {
  const isEn = locale === "en";
  return (
    <section className="mt-4 rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{isEn ? "Talent Intelligence Report" : "人才情报报告"}</p>
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {isEn ? "Four capability views grounded in public evidence." : "围绕公开证据拆解技术、研究、影响力和职业轨迹。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            {isEn ? "Verified" : "已验证"} {report.audit.verified_count}
          </span>
          <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
            {isEn ? "Gaps" : "缺口"} {report.audit.unverified_count}
          </span>
          <span className="rounded-full bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-700 ring-1 ring-gray-200">
            {isEn ? "Sources" : "来源"} {report.audit.independent_sources}
          </span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {report.sections.map((section) => (
          <div key={section.key} className="rounded-xl bg-gray-50 p-3 ring-1 ring-black/5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-900">{section.title}</p>
              <span className="text-[11px] font-medium text-gray-500">{section.evidence_count}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-600">{section.summary}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-xl bg-blue-50/70 p-3 ring-1 ring-blue-100">
        <p className="text-xs font-semibold text-blue-900">{isEn ? "Recommended next steps" : "推荐下一步"}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 text-blue-900/80">
          {report.next_actions.map((action) => <li key={action}>{action}</li>)}
        </ul>
      </div>
      <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
        <p className="text-xs font-semibold text-gray-900">{isEn ? "Related Talent" : "相关人才"}</p>
        {related.items.length > 0 ? (
          <div className="mt-2 space-y-2">
            {related.items.slice(0, 4).map((item) => (
              <div key={item.name} className="rounded-lg bg-gray-50 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">{item.name}</span>
                  {item.role && <span className="text-xs text-gray-500">{item.role}</span>}
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-600">{item.relation_reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs leading-5 text-gray-500">
            {isEn ? "No evidence-backed related candidates in this result yet." : "本轮结果里暂未发现有证据支撑的相关候选人。"}
          </p>
        )}
        <p className="mt-2 rounded-lg bg-gray-50 p-2 text-xs leading-5 text-gray-600">{related.generated_search_brief}</p>
      </div>
    </section>
  );
}

export function CandidateProfileView({
  candidate,
  result,
  relatedCandidates,
  onBackfillJob,
  backfillDisabled = false,
  locale,
}: {
  candidate: TalentCandidate;
  result?: TalentSearchResult;
  relatedCandidates?: unknown[];
  onBackfillJob?: (job: CoverageBackfillJob) => void;
  backfillDisabled?: boolean;
} & ResultLocaleProps) {
  const readingSummary = buildCandidateReadingSummary({ result, candidate, locale: locale ?? "zh" }) as CandidateReadingSummary;
  const reviewBrief = buildCandidateReviewBrief({ result, candidate, locale: locale ?? "zh" }) as CandidateReviewBrief;
  const dossier = buildCandidateEvidenceDossier({ result, candidate, locale: locale ?? "zh" }) as CandidateEvidenceDossier;
  const evidenceMatrix = buildCandidateEvidenceMatrix({ result, candidate, locale: locale ?? "zh" }) as CandidateEvidenceMatrix;
  const intelligence = buildTalentIntelligenceReport({ candidate, locale: locale ?? "zh" });
  const relatedTalent = buildRelatedTalentView({
    candidate,
    pool: ((relatedCandidates ?? result?.candidates ?? []) as TalentCandidate[]).filter((item) => item.name !== candidate.name) as never[],
    locale: locale ?? "zh",
  }) as {
    items: Array<{ name: string; role: string; relation_reason: string; evidence_urls: string[] }>;
    generated_search_brief: string;
  };

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

      <CandidateReviewBriefView brief={reviewBrief} />

      <TalentIntelligencePanel report={intelligence} related={relatedTalent} locale={locale ?? "zh"} />

      <AIVerticalProfileView result={result} candidate={candidate} locale={locale} />

      <CandidateReadingSummaryView summary={readingSummary} />

      <CandidateEvidenceDossierView dossier={dossier} matrix={evidenceMatrix} onBackfillJob={onBackfillJob} backfillDisabled={backfillDisabled} locale={locale} />

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
