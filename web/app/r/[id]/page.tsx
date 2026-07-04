// app/r/[id]/page.tsx —— 可分享的只读核实报告 (服务端渲染, 公开)。
// 把一条 research_runs 渲染成"带证据的核实报告", 可直接发给客户/投资人。
import Link from "next/link";
import type { Metadata } from "next";
import { FiArrowRight } from "react-icons/fi";
import { getRunById } from "@/lib/db";
import { buildProjectCandidateGraphView, getProject, listProjectClientDeliveryWeeklyArchives, projectRuns, recordProjectRoleAgentEvent, upsertProjectClientDeliveryWeeklyArchive } from "@/lib/projects";
import { listOutreachQueue } from "@/lib/outreach-threads";
import { buildProjectInboxQueueView } from "@/lib/inbox";
import { buildRoleOutreachSettings } from "@/lib/outreach-settings.mjs";
import { buildRoleAgentWorkspaceView } from "@/lib/role-agent-workspace.mjs";
import { attachClientDeliveryLoopSnapshot, buildClientDeliverySnapshot, buildClientDeliveryVersionHistory, buildClientDeliveryWeeklyArchive } from "@/lib/smart-report.mjs";
import { buildClientDeliveryWeeklyArchiveFromRows } from "@/lib/client-delivery-weekly-archive.mjs";
import { buildClientDeliveryShareHref, verifyClientDeliveryShareAccess } from "@/lib/report-share-access.mjs";
import { ClientReportFeedbackForm } from "@/components/ClientReportFeedbackForm";
import { getUser } from "@/lib/session";
import {
  CandidateCard,
  CandidateComparisonView,
  CandidateProfileView,
  ClientDeliveryLoopPanel,
  EvidenceGraphView,
  ShortlistDeliveryReportView,
  SmartReportPanel,
  TrustReportView,
  type Claim,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import {
  isTalentSearchResult,
  normalizeTalentSearchResult,
  type TalentSearchResult,
} from "@/lib/talent-profile.mjs";
import { normalizeLocale } from "@/lib/i18n.mjs";

type Locale = "zh" | "en";
type ClientDeliveryVisibility = ReturnType<typeof buildRoleOutreachSettings>["client_delivery_visibility"];
type ClientDeliverySnapshot = ReturnType<typeof buildClientDeliverySnapshot>;
type ClientDeliveryVersionHistory = ReturnType<typeof buildClientDeliveryVersionHistory>;
type ClientDeliveryWeeklyArchive = ReturnType<typeof buildClientDeliveryWeeklyArchive>;

export const runtime = "nodejs";
const REPORT_FETCH_TIMEOUT_MS = 4500;

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g stroke="#111111" strokeWidth={22} fill="none" strokeLinecap="round">
        <circle cx="256" cy="256" r="130" />
        <circle cx="256" cy="256" r="70" />
        <path d="M186 256a70 70 0 1 0 70-70" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#9EFF4F" />
    </svg>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getRunByIdWithTimeout(id: string) {
  return Promise.race([
    getRunById(id),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), REPORT_FETCH_TIMEOUT_MS)),
  ]);
}

const REPORT_COPY = {
  zh: {
    missingTitle: "报告不存在或链接已失效",
    missingBody: "这条核实记录找不到了。",
    missingAction: "去 SignalHire 验证候选人",
    searchBadge: "AI 人才报告",
    verifyBadge: "证据审计报告",
    searchContext: "岗位画像",
    verifyContext: "候选人证据审计",
    contextNote: "SignalHire 基于公开来源生成 · 候选人按 AI 方向分层 · 关键结论附可点击证据",
    noCandidates: "这份报告没有可展示的候选人结果。",
    searchCtaTitle: "想为你的 AI 岗位生成这样的候选名单？",
    searchCtaBody: "SignalHire 从公开来源搜索全球 AI 人才，并把论文、开源、实践和工作经历证据整理成可交付报告。",
    searchCtaButton: "生成 AI 人才候选名单",
    verifyCtaTitle: "想审计你自己的候选人证据？",
    verifyCtaBody: "SignalHire 从公开来源交叉验证候选人声称，标出已验证、未验证和矛盾点。",
    verifyCtaButton: "开始审计候选人",
    unknownCandidate: "未知候选人",
    missingMetaTitle: "报告不存在 · SignalHire",
    searchMetaSuffix: "核实报告",
    searchMetaDesc: "SignalHire 生成的 AI 人才候选名单与公开证据报告。",
    verifyMetaDesc: "SignalHire 生成的候选人证据审计报告。",
    missingMetaDesc: "这条 SignalHire 研究记录不可用。",
    invalidShareTokenBody: "这条客户交付报告需要有效分享链接。",
  },
  en: {
    missingTitle: "Report not found or link expired",
    missingBody: "This research record could not be found.",
    missingAction: "Verify a candidate with SignalHire",
    searchBadge: "AI talent report",
    verifyBadge: "Evidence audit report",
    searchContext: "Role profile",
    verifyContext: "Candidate evidence audit",
    contextNote: "Generated from public sources by SignalHire · Candidates are grouped by AI direction · Key conclusions include clickable evidence",
    noCandidates: "This report does not contain displayable candidate results.",
    searchCtaTitle: "Want to generate this kind of shortlist for your AI role?",
    searchCtaBody: "SignalHire searches public sources for global AI talent and turns papers, open-source work, practical output, and work history into a delivery-ready report.",
    searchCtaButton: "Generate an AI talent shortlist",
    verifyCtaTitle: "Want to audit your own candidate evidence?",
    verifyCtaBody: "SignalHire cross-checks candidate claims against public sources and marks verified, unverified, and contradicted points.",
    verifyCtaButton: "Start a candidate audit",
    unknownCandidate: "Unknown candidate",
    missingMetaTitle: "Report not found · SignalHire",
    searchMetaSuffix: "Evidence report",
    searchMetaDesc: "An AI talent shortlist and public evidence report generated by SignalHire.",
    verifyMetaDesc: "A candidate evidence audit report generated by SignalHire.",
    missingMetaDesc: "This SignalHire research record is unavailable.",
    invalidShareTokenBody: "This client delivery report requires a valid share link.",
  },
} as const;

function rc(locale: Locale, key: keyof typeof REPORT_COPY.zh) {
  return REPORT_COPY[locale][key];
}

function normalizeLegacyClaim(claim: unknown): Claim | null {
  if (!isRecord(claim)) return null;
  const verdict = cleanString(claim.verdict);
  return {
    claim: cleanString(claim.claim),
    verdict: verdict === "verified" || verdict === "contradicted" ? verdict : "unverified",
    evidence: Array.isArray(claim.evidence)
      ? claim.evidence.filter(isRecord).map((evidence) => ({
          note: cleanString(evidence.note),
          url: cleanString(evidence.url),
        }))
      : [],
  };
}

function normalizeLegacyCandidates(result: unknown, locale: Locale): Candidate[] {
  if (!isRecord(result) || !Array.isArray(result.candidates)) return [];
  return result.candidates.filter(isRecord).map((candidate) => {
    const links = isRecord(candidate.links) ? candidate.links : {};
    return {
      name: cleanString(candidate.name) || rc(locale, "unknownCandidate"),
      headline: cleanString(candidate.headline),
      links: {
        github: cleanString(links.github) || null,
        linkedin: cleanString(links.linkedin) || null,
        other: cleanString(links.other) || null,
      },
      claims: Array.isArray(candidate.claims)
        ? candidate.claims.map(normalizeLegacyClaim).filter((claim): claim is Claim => Boolean(claim))
        : [],
      summary: cleanString(candidate.summary),
    };
  });
}

function defaultClientDeliveryVisibility(): ClientDeliveryVisibility {
  return buildRoleOutreachSettings().client_delivery_visibility;
}

function emptyClientDeliveryVersionHistory(locale: Locale): ClientDeliveryVersionHistory {
  return buildClientDeliveryVersionHistory([], { locale });
}

function emptyClientDeliveryWeeklyArchive(locale: Locale): ClientDeliveryWeeklyArchive {
  return buildClientDeliveryWeeklyArchive([], { locale });
}

function emptyClientDeliverySnapshot(locale: Locale): ClientDeliverySnapshot {
  return {
    title: locale === "en" ? "Frozen delivery snapshot" : "冻结交付快照",
    summary: "",
    snapshot_id: "",
    frozen_at: "",
    window_label: "",
    metrics: { new_candidates: 0, contacted: 0, replied: 0, interview_ready: 0, confirmed: 0 },
    candidate_count: 0,
    evidence_summary: "",
    risks: [],
    next_actions: [],
  };
}

function ClientDeliveryWeeklyArchivePanel({ weeklyArchive, locale }: { weeklyArchive: ClientDeliveryWeeklyArchive; locale: Locale }) {
  if (!weeklyArchive.items.length) return null;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";
  const metricLabels = {
    new_candidates: locale === "en" ? "New" : "新增",
    contacted: locale === "en" ? "Contacted" : "已联系",
    replied: locale === "en" ? "Replied" : "已回复",
    interview_ready: locale === "en" ? "Ready" : "可约面",
    confirmed: locale === "en" ? "Confirmed" : "已确认",
  };
  return (
    <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
      <div>
        <h2 className="text-base font-semibold text-gray-950">{weeklyArchive.title}</h2>
        <p className="mt-1 text-sm text-gray-500">{weeklyArchive.summary}</p>
      </div>
      <div className="mt-4 space-y-3">
        {weeklyArchive.items.map((item) => {
          const weekStart = item.week_start
            ? new Date(`${item.week_start}T00:00:00.000Z`).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })
            : "";
          const weekEnd = item.week_end
            ? new Date(`${item.week_end}T00:00:00.000Z`).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
            : "";
          return (
            <div key={item.archive_id} className="rounded-2xl bg-gray-50 p-3 ring-1 ring-black/5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-950">{item.label}</p>
                  <p className="text-xs text-gray-500">
                    {[weekStart && weekEnd ? `${weekStart} - ${weekEnd}` : "", item.archive_id].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600 ring-1 ring-black/5">
                  {locale === "en" ? `${item.reports.length} reports` : `${item.reports.length} 份报告`}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(item.metrics).map(([key, value]) => (
                  <span key={key} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/5">
                    {metricLabels[key as keyof typeof metricLabels]} · {value}
                  </span>
                ))}
              </div>
              <div className="mt-3 divide-y divide-gray-200/70">
                {item.reports.slice(0, 3).map((report) => (
                  <Link key={report.id} href={report.href || "#"} className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-gray-900">{report.label}</span>
                      <span className="mt-0.5 block text-[11px] text-gray-500">
                        {[report.candidate_count ? `${report.candidate_count} ${locale === "en" ? "candidates" : "位候选人"}` : "", report.summary].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <FiArrowRight className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ClientDeliverySnapshotPanel({ deliverySnapshot, locale }: { deliverySnapshot: ClientDeliverySnapshot; locale: Locale }) {
  if (!deliverySnapshot.snapshot_id) return null;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";
  const frozenAt = deliverySnapshot.frozen_at
    ? new Date(deliverySnapshot.frozen_at).toLocaleString(dateLocale, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  const metricLabels = {
    new_candidates: locale === "en" ? "New" : "新增",
    contacted: locale === "en" ? "Contacted" : "已联系",
    replied: locale === "en" ? "Replied" : "已回复",
    interview_ready: locale === "en" ? "Ready" : "可约面",
    confirmed: locale === "en" ? "Confirmed" : "已确认",
  };
  return (
    <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-950">{deliverySnapshot.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{deliverySnapshot.summary}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
          {deliverySnapshot.snapshot_id}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{locale === "en" ? "Frozen at" : "冻结时间"}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{frozenAt || "-"}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{locale === "en" ? "Window" : "周期"}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{deliverySnapshot.window_label || "-"}</p>
        </div>
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{locale === "en" ? "Candidates" : "候选人"}</p>
          <p className="mt-1 text-sm font-semibold text-gray-900">{deliverySnapshot.candidate_count}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {Object.entries(deliverySnapshot.metrics).map(([key, value]) => (
          <span key={key} className="rounded-full bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/5">
            {metricLabels[key as keyof typeof metricLabels]} · {value}
          </span>
        ))}
      </div>
    </section>
  );
}

function ClientDeliveryVersionHistoryPanel({ versionHistory, locale }: { versionHistory: ClientDeliveryVersionHistory; locale: Locale }) {
  if (!versionHistory.items.length) return null;
  const dateLocale = locale === "en" ? "en-US" : "zh-CN";
  return (
    <section className="rounded-[28px] border border-black/10 bg-white p-5 shadow-[0_18px_52px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-950">{versionHistory.title}</h2>
          <p className="mt-1 text-sm text-gray-500">{versionHistory.summary}</p>
        </div>
      </div>
      <div className="mt-4 divide-y divide-gray-100">
        {versionHistory.items.map((item) => {
          const deliveredAt = item.delivered_at
            ? new Date(item.delivered_at).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
            : "";
          return (
            <Link key={item.id} href={item.href || "#"} className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-semibold text-gray-900">{item.label}</span>
                  {item.is_current ? (
                    <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[11px] font-semibold text-lime-800">
                      {locale === "en" ? "Current" : "当前"}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-gray-500">
                  {[
                    deliveredAt,
                    locale === "en" ? `${item.candidate_count} candidates` : `${item.candidate_count} 位候选人`,
                    item.summary,
                  ].filter(Boolean).join(" · ")}
                </span>
              </span>
              <FiArrowRight className="mt-0.5 shrink-0 text-gray-400" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}

async function buildProjectShareDeliveryView(row: Awaited<ReturnType<typeof getRunById>>, runId: string, locale: Locale): Promise<{
  result: unknown;
  visibility: ClientDeliveryVisibility;
  deliverySnapshot: ClientDeliverySnapshot;
  versionHistory: ClientDeliveryVersionHistory;
  weeklyArchive: ClientDeliveryWeeklyArchive;
}> {
  const baseResult = row?.result;
  const userId = cleanString(row?.user_id);
  const projectId = cleanString(row?.project_id);
  if (row?.kind !== "search" || !userId || !projectId || !isRecord(baseResult)) {
    return {
      result: baseResult,
      visibility: defaultClientDeliveryVisibility(),
      deliverySnapshot: emptyClientDeliverySnapshot(locale),
      versionHistory: emptyClientDeliveryVersionHistory(locale),
      weeklyArchive: emptyClientDeliveryWeeklyArchive(locale),
    };
  }
  try {
    const [project, candidateGraph, outreachQueue, inboxQueue, runs, persistedWeeklyArchives] = await Promise.all([
      getProject(userId, projectId),
      buildProjectCandidateGraphView(userId, projectId),
      listOutreachQueue({ userId, projectId }),
      buildProjectInboxQueueView(userId, projectId),
      projectRuns(userId, projectId, 6),
      listProjectClientDeliveryWeeklyArchives({ userId, projectId, limit: 8 }),
    ]);
    const settings = buildRoleOutreachSettings(project?.outreach_settings);
    const versionHistory = buildClientDeliveryVersionHistory(runs, { currentRunId: runId, locale });
    const derivedWeeklyArchive = buildClientDeliveryWeeklyArchive(runs, { locale });
    const persistedWeeklyArchive = buildClientDeliveryWeeklyArchiveFromRows(persistedWeeklyArchives, { locale });
    const weeklyArchive = derivedWeeklyArchive.items.length ? derivedWeeklyArchive : persistedWeeklyArchive;
    void upsertProjectClientDeliveryWeeklyArchive({
      userId,
      projectId,
      items: derivedWeeklyArchive.items,
    }).catch(() => {});
    const workspace = buildRoleAgentWorkspaceView({
      role: { id: projectId, status: "active" },
      settings,
      candidateGraph,
      outreachQueue,
      inboxQueue,
      smartReport: baseResult,
      locale,
    });
    if (!workspace.delivery_summary) {
      return {
        result: baseResult,
        visibility: settings.client_delivery_visibility,
        deliverySnapshot: buildClientDeliverySnapshot({ ...row, id: runId }, baseResult, { locale }),
        versionHistory,
        weeklyArchive,
      };
    }
    const deliveryResult = attachClientDeliveryLoopSnapshot(baseResult, {
      weekly_progress: workspace.delivery_summary.weekly_progress,
      risks: workspace.delivery_summary.risks,
      next_actions: workspace.delivery_summary.next_actions,
    });
    return {
      result: deliveryResult,
      visibility: settings.client_delivery_visibility,
      deliverySnapshot: buildClientDeliverySnapshot({ ...row, id: runId }, deliveryResult, { locale }),
      versionHistory,
      weeklyArchive,
    };
  } catch {
    return {
      result: baseResult,
      visibility: defaultClientDeliveryVisibility(),
      deliverySnapshot: emptyClientDeliverySnapshot(locale),
      versionHistory: emptyClientDeliveryVersionHistory(locale),
      weeklyArchive: emptyClientDeliveryWeeklyArchive(locale),
    };
  }
}

async function recordClientDeliveryReportView(row: Awaited<ReturnType<typeof getRunById>>, runId: string) {
  const userId = cleanString(row?.user_id);
  const projectId = cleanString(row?.project_id);
  if (row?.kind !== "search" || !userId || !projectId) return;
  try {
    await recordProjectRoleAgentEvent({
      userId,
      id: projectId,
      event: {
        event_type: "client_report_view",
        action_type: "shareable_client_delivery_loop",
        detail: buildClientDeliveryShareHref({ ...row, id: runId }),
        at: new Date().toISOString(),
      },
    });
  } catch {
    // Public report rendering must not depend on analytics writes.
  }
}

async function clientDeliveryAccessPolicyForRow(row: Awaited<ReturnType<typeof getRunById>>) {
  const userId = cleanString(row?.user_id);
  const projectId = cleanString(row?.project_id);
  if (!userId || !projectId) return undefined;
  const project = await getProject(userId, projectId);
  return buildRoleOutreachSettings(project?.outreach_settings).client_delivery_access;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; t?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { lang, t } = await searchParams;
  const locale = normalizeLocale(lang);
  const row = await getRunByIdWithTimeout(id);
  const shareAccess = verifyClientDeliveryShareAccess(row, t);
  if (!row || !shareAccess.allowed) return { title: rc(locale, "missingMetaTitle"), description: rc(locale, "missingMetaDesc") };
  return {
    title: `${row.label} - ${rc(locale, "searchMetaSuffix")} · SignalHire`,
    description: row.summary || (
      row.kind === "search"
        ? rc(locale, "searchMetaDesc")
        : rc(locale, "verifyMetaDesc")
    ),
  };
}

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string; t?: string }>;
}) {
  const { id } = await params;
  const { lang, t } = await searchParams;
  const locale = normalizeLocale(lang);
  const row = await getRunByIdWithTimeout(id);
  const viewer = await getUser();
  const accessPolicy = await clientDeliveryAccessPolicyForRow(row);
  const shareAccess = verifyClientDeliveryShareAccess(row, t, { viewer, accessPolicy });
  const visibleRow = shareAccess.allowed ? row : null;
  const shareTokenQuery = t ? `&t=${encodeURIComponent(t)}` : "";
  if (visibleRow) await recordClientDeliveryReportView(visibleRow, id);
  const shareView = visibleRow
    ? await buildProjectShareDeliveryView(visibleRow, id, locale)
    : {
        result: null,
        visibility: defaultClientDeliveryVisibility(),
        deliverySnapshot: emptyClientDeliverySnapshot(locale),
        versionHistory: emptyClientDeliveryVersionHistory(locale),
        weeklyArchive: emptyClientDeliveryWeeklyArchive(locale),
      };
  const shareResult = shareView.result;
  const visibility = shareView.visibility;
  const deliverySnapshot = shareView.deliverySnapshot;
  const versionHistory = shareView.versionHistory;
  const weeklyArchive = shareView.weeklyArchive;
  const talentResult: TalentSearchResult | null = visibleRow?.kind === "search" && isTalentSearchResult(shareResult)
    ? normalizeTalentSearchResult(shareResult)
    : null;
  const legacyCandidates = visibleRow?.kind === "search" && !talentResult
    ? normalizeLegacyCandidates(shareResult, locale)
    : [];
  const canCollectFeedback = Boolean(visibleRow?.kind === "search" && visibleRow.user_id && visibleRow.project_id && t && visibility.feedback_form);
  const cta = visibleRow?.kind === "verify"
    ? {
        title: rc(locale, "verifyCtaTitle"),
        body: rc(locale, "verifyCtaBody"),
        button: rc(locale, "verifyCtaButton"),
      }
    : {
        title: rc(locale, "searchCtaTitle"),
        body: rc(locale, "searchCtaBody"),
        button: rc(locale, "searchCtaButton"),
      };

  return (
    <div className="min-h-full" lang={locale === "en" ? "en" : "zh-CN"}>
      {/* 顶栏 */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
          <LogoMark className="h-8 w-8" />
          <span className="text-[17px] tracking-tight">SignalHire</span>
        </Link>
        <div className="flex items-center gap-2">
          <nav aria-label="Report language" className="inline-flex rounded-full bg-gray-100 p-1 text-xs font-semibold text-gray-500">
            {(["zh", "en"] as const).map((option) => (
              <Link
                key={option}
                href={`/r/${id}?lang=${option}${shareTokenQuery}`}
                className={`rounded-full px-2.5 py-1 transition ${locale === option ? "bg-white text-gray-950 shadow-sm" : "hover:text-gray-900"}`}
                aria-current={locale === option ? "true" : undefined}
              >
                {option === "zh" ? "中文" : "EN"}
              </Link>
            ))}
          </nav>
          <span className="hidden rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600 sm:inline-flex">
            {visibleRow?.kind === "verify" ? rc(locale, "verifyBadge") : rc(locale, "searchBadge")}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20">
        {!visibleRow ? (
          <div className="mt-10 rounded-[28px] border border-black/10 bg-white/86 p-8 text-center shadow-[0_18px_52px_rgba(15,23,42,0.06)] backdrop-blur-xl">
            <p className="text-lg font-semibold text-gray-900">{rc(locale, "missingTitle")}</p>
            <p className="mt-1 text-sm text-gray-500">{shareAccess.reason === "invalid_share_token" || shareAccess.reason === "missing_share_token" ? rc(locale, "invalidShareTokenBody") : rc(locale, "missingBody")}</p>
            <Link href="/" className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-gray-800">
              {rc(locale, "missingAction")}
              <FiArrowRight aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            {/* 上下文 */}
            <div className="mt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {visibleRow.kind === "search" ? rc(locale, "searchContext") : rc(locale, "verifyContext")}
              </p>
              <blockquote className="mt-2 whitespace-pre-line rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                {visibleRow.query_text}
              </blockquote>
              <p className="mt-2 text-xs text-gray-400">
                {rc(locale, "contextNote")}
              </p>
            </div>

            {/* 结果 */}
            <div className="mt-6 space-y-4">
              {visibleRow.kind === "search" ? (
                talentResult ? (
                  <>
                    {visibility.delivery_loop ? <ClientDeliveryLoopPanel result={talentResult} locale={locale} /> : null}
                    {visibility.delivery_loop && deliverySnapshot.snapshot_id ? (
                      <ClientDeliverySnapshotPanel deliverySnapshot={deliverySnapshot} locale={locale} />
                    ) : null}
                    {visibility.delivery_loop && versionHistory.items.length ? (
                      <ClientDeliveryVersionHistoryPanel versionHistory={versionHistory} locale={locale} />
                    ) : null}
                    {visibility.delivery_loop && weeklyArchive.items.length ? (
                      <ClientDeliveryWeeklyArchivePanel weeklyArchive={weeklyArchive} locale={locale} />
                    ) : null}
                    {canCollectFeedback ? (
                      <ClientReportFeedbackForm reportId={id} token={t ?? ""} locale={locale} />
                    ) : null}
                    {visibility.smart_report ? <SmartReportPanel result={talentResult} locale={locale} /> : null}
                    {visibility.candidate_details ? (
                      <>
                        <ShortlistDeliveryReportView result={talentResult} locale={locale} />
                        <CandidateComparisonView result={talentResult} locale={locale} />
                        {talentResult.candidates.map((candidate, index) => (
                          <div key={`${candidate.name}-${index}`} className="space-y-3">
                            <EvidenceGraphView result={talentResult} candidate={candidate} locale={locale} />
                            <CandidateProfileView candidate={candidate} result={talentResult} locale={locale} />
                          </div>
                        ))}
                      </>
                    ) : null}
                  </>
                ) : legacyCandidates.length > 0 && visibility.candidate_details ? (
                  legacyCandidates.map((c, i) => <CandidateCard key={i} c={c} delay={i * 90} locale={locale} />)
                ) : (
                  <p className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-gray-500">
                    {rc(locale, "noCandidates")}
                  </p>
                )
              ) : (
                <TrustReportView r={visibleRow.result as VerifyReport} locale={locale} />
              )}
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-[28px] border border-black/10 bg-white/86 p-6 text-center shadow-[0_18px_52px_rgba(15,23,42,0.06)] backdrop-blur-xl">
              <p className="text-base font-semibold text-gray-900">{cta.title}</p>
              <p className="mt-1 text-sm text-gray-500">{cta.body}</p>
              <Link href="/" className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-gray-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_32px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 hover:bg-gray-800">
                {cta.button}
                <FiArrowRight aria-hidden="true" />
              </Link>
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-xs text-gray-400">
          Powered by SignalHire Deep Research
        </footer>
      </main>
    </div>
  );
}
