"use client";

// /app/projects/[id] —— 招聘项目详情
// 头部 (name/brief 可编辑 + 状态 + 删除) + KPI + 候选人列表 (按 project 过滤) + 历史搜索
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiMail, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";
import { CandidateComparisonView, CandidateProfileView, EvidencePriorityPanel } from "@/components/result";
import { useI18n } from "@/components/LanguageProvider";
import OutreachModal from "@/components/OutreachModal";
import {
  EmptyState,
  IconButton,
  LoadingState,
  PrimaryAction,
  SecondaryAction,
  SegmentedControl,
  StatusBadge,
  Surface,
} from "@/components/ui/signal-ui";
import { buildCandidateFeedbackPanel, buildProjectActionBrief, buildProjectCandidateDecisionQueue, buildProjectCandidateFeedbackSummary, buildProjectControlRoom, buildProjectDetailHierarchy, buildProjectResearchRounds, buildProjectSearchConsole } from "@/lib/research-loop.mjs";
import { buildCandidateDecisionSignal, buildEvidencePriorityView, buildProjectEvidenceMatrix } from "@/lib/evidence-priority.mjs";
import type { TalentCandidate } from "@/lib/talent-profile.mjs";

type ProjectStatus = "open" | "paused" | "closed";
type ShortlistStatus = "new" | "contacted" | "interviewing" | "hired" | "rejected";
type ProjectNextStepsView = {
  locale: string;
  title: string;
  latestRunLabel?: string;
  actions: Array<{
    key: string;
    label: string;
    detail: string;
  }>;
};
type ProjectSearchConsoleView = {
  title: string;
  description: string;
  briefTitle: string;
  briefText: string;
  latestRoundTitle: string;
  latestRoundEmpty: string;
  latestRound: null | {
    id: string;
    roundNumber: number;
    kind: "search" | "verify";
    badge: string;
    label: string;
    description: string;
    summary: string;
    status: string;
  };
  feedback: null | {
    title: string;
    items: Array<{ key: string; label: string; value: string }>;
  };
  nextSearchInput: string;
  refinementSuggestions: {
    title: string;
    items: Array<{ key: string; label: string; detail: string }>;
  };
  candidateFeedbackSignals: {
    title: string;
    items: Array<{ key: string; label: string; detail: string }>;
    empty: boolean;
  };
  constraintDiff: {
    title: string;
    originalTitle: string;
    optimizedTitle: string;
    originalInput: string;
    optimizedInput: string;
    editableHint: string;
    empty: boolean;
    changes: Array<{
      key: string;
      type: "add" | "strengthen" | "reduce" | string;
      typeLabel: string;
      sourceLabel: string;
      label: string;
      detail: string;
    }>;
  };
  nextSteps: ProjectNextStepsView;
  priorities: {
    title: string;
    items: Array<{
      key: string;
      label: string;
      detail: string;
    }>;
  };
};
type ProjectActionBriefView = {
  title: string;
  summary: string;
  primaryAction: {
    key: string;
    label: string;
    detail: string;
    targetItemId: string;
    backfillInput: string;
  };
  actions: Array<{
    key: string;
    count?: number;
    label: string;
    detail: string;
    targetItemId: string;
    backfillInput: string;
  }>;
};
type ProjectControlRoomView = {
  title: string;
  description: string;
  focusTitle: string;
  focus: {
    key: string;
    label: string;
    detail: string;
    actionDetail: string;
    targetItemId: string;
    backfillInput: string;
  };
  nextSteps: ProjectNextStepsView;
  cards: Array<{
    key: string;
    label: string;
    value: string;
    detail: string;
  }>;
};
type ProjectDetailHierarchyView = {
  hidden: string[];
};
type ProjectCandidateFeedbackSummaryView = {
  title: string;
  empty: boolean;
  reviewedCount: number;
  summary: string;
  nextSearchHint: string;
  items: Array<{ key: string; label: string; detail: string }>;
};
type ProjectResearchRoundsView = {
  title: string;
  emptyText: string;
  items: Array<{
    id: string;
    roundNumber: number;
    kind: "search" | "verify";
    badge: string;
    label: string;
    summary: string;
    status: string;
    queryText: string;
    description: string;
    nextSearchInput: string;
    feedbackSummary: null | {
      title: string;
      items: Array<{ key: string; label: string; value: string }>;
    };
  }>;
};
type ProjectEvidenceMatrixView = {
  title: string;
  description: string;
  summary: {
    total: number;
    active: number;
    rejected: number;
    ready_to_review: number;
    needs_backfill: number;
    risk_review: number;
  };
  rows: Array<{
    id: string;
    name: string;
    role: string;
    status_label: string;
    match_score: number;
    evidence_quality: string;
    independent_sources: number;
    verified_count: number;
    unverified_count: number;
    contradicted_count: number;
    priority: string;
    priority_label: string;
    decision_hint: string;
    action: {
      key: string;
      label: string;
      search_input: string;
    };
  }>;
  empty: boolean;
};

const PROJ_STATUS_META: Record<ProjectStatus, { labelKey: string; chip: string; dot: string }> = {
  open:   { labelKey: "projects.detail.status.open", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  paused: { labelKey: "projects.detail.status.paused", chip: "bg-amber-50 text-amber-800 ring-amber-200",     dot: "bg-amber-500" },
  closed: { labelKey: "projects.detail.status.closed", chip: "bg-gray-100 text-gray-600 ring-gray-200",       dot: "bg-gray-400" },
};

const SHORT_STATUS: { value: ShortlistStatus; labelKey: string; chip: string; dot: string }[] = [
  { value: "new",          labelKey: "projects.detail.candidateStatus.new",          chip: "bg-gray-100 text-gray-700 ring-gray-200",        dot: "bg-gray-400" },
  { value: "contacted",    labelKey: "projects.detail.candidateStatus.contacted",    chip: "bg-blue-50 text-blue-700 ring-blue-200",         dot: "bg-blue-500" },
  { value: "interviewing", labelKey: "projects.detail.candidateStatus.interviewing", chip: "bg-amber-50 text-amber-800 ring-amber-200",      dot: "bg-amber-500" },
  { value: "hired",        labelKey: "projects.detail.candidateStatus.hired",        chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { value: "rejected",     labelKey: "projects.detail.candidateStatus.rejected",     chip: "bg-rose-50 text-rose-700 ring-rose-200",         dot: "bg-rose-400" },
];

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    brief: string | null;
    status: ProjectStatus;
    candidates_total: number;
    candidates_active: number;
    runs_total: number;
    runs_active: number;
  };
  breakdown: Record<ShortlistStatus, number>;
  runs: Array<{
    id: string;
    kind: "search" | "verify";
    label: string;
    summary: string | null;
    status: string;
    query_text: string;
    updated_at: string;
    result?: unknown;
  }>;
}

interface ShortlistItem {
  id: string;
  source_run_id: string | null;
  project_id: string | null;
  candidate: unknown;
  status: ShortlistStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type CandidateLike = {
  name?: string;
  headline?: string;
  current_role?: string | null;
  current_company?: string | null;
  match_score?: number;
  ai_directions?: string[];
};
function asCandidate(x: unknown): CandidateLike { return (x ?? {}) as CandidateLike; }
type CandidateFeedbackValue = {
  precision?: string;
  satisfaction?: string;
  issue?: string;
  focus?: string;
};
function isRecord(x: unknown): x is Record<string, unknown> {
  return Boolean(x && typeof x === "object" && !Array.isArray(x));
}
function candidateFeedback(candidate: unknown): CandidateFeedbackValue {
  if (!isRecord(candidate) || !isRecord(candidate.feedback)) return {};
  return candidate.feedback as CandidateFeedbackValue;
}
function candidateWithFeedback(candidate: unknown, feedback: CandidateFeedbackValue): Record<string, unknown> {
  return isRecord(candidate) ? { ...candidate, feedback } : { feedback };
}
function isTalentShape(x: unknown): x is TalentCandidate {
  const c = asCandidate(x);
  return typeof c.match_score === "number" && Array.isArray(c.ai_directions);
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, t } = useI18n();
  const id = String(params?.id ?? "");

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<ShortlistItem[] | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShortlistStatus | "all">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const reloadDetail = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "加载失败");
      setDetail(j as ProjectDetail);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const [detailRes, itemsRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/shortlist?project=${encodeURIComponent(id)}`),
        ]);
        const [detailJson, itemsJson] = await Promise.all([detailRes.json(), itemsRes.json()]);
        if (cancelled) return;
        if (!detailRes.ok) throw new Error(detailJson.error || "加载失败");
        if (!itemsRes.ok) throw new Error(itemsJson.error || "候选人加载失败");
        setDetail(detailJson as ProjectDetail);
        setItems((itemsJson.items ?? []) as ShortlistItem[]);
        setError("");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (statusFilter === "all") return items;
    return items.filter((it) => it.status === statusFilter);
  }, [items, statusFilter]);

  const selectedItem = useMemo(() => (items ?? []).find((it) => it.id === selectedItemId) ?? null, [items, selectedItemId]);
  const projectComparisonResult = useMemo(() => ({
    candidates: (items ?? []).map((it) => it.candidate),
  }), [items]);
  const projectEvidencePriorityView = useMemo(() => {
    if (!items || filteredItems.length === 0) return null;
    return buildEvidencePriorityView({
      candidates: filteredItems.map((item) => item.candidate),
      locale,
    });
  }, [filteredItems, items, locale]);
  const projectEvidenceMatrix = useMemo(() => {
    if (!items || filteredItems.length === 0) return null;
    return buildProjectEvidenceMatrix({ items: filteredItems, locale }) as ProjectEvidenceMatrixView;
  }, [filteredItems, items, locale]);

  async function deleteProject() {
    if (!confirm("删除这个项目?\n关联候选人和历史会回到「候选池(全部)」, 不会丢失。")) return;
    const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/app/projects");
    else alert("删除失败");
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <SecondaryAction href="/app/projects" className="min-h-9 px-3 py-2 text-xs">
          <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          回项目列表
        </SecondaryAction>
        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : (
          <LoadingState title="正在加载项目" description="正在读取项目画像、候选人和历史研究。" />
        )}
      </div>
    );
  }

  const p = detail.project;
  const briefForSearch = (p.brief ?? "").trim() || p.name;
  const verifyHref = `/app/verify?project=${id}`;
  const projectConsole = buildProjectSearchConsole({
    project: p,
    runs: detail.runs,
    items: items ?? [],
    candidateCount: p.candidates_total,
    hasFilter: statusFilter !== "all",
    locale,
  }) as ProjectSearchConsoleView;
  const searchHref = `/app/search?project=${id}&q=${encodeURIComponent(projectConsole.nextSearchInput || briefForSearch)}`;
  const projectRounds = buildProjectResearchRounds({
    runs: detail.runs,
    locale,
  }) as ProjectResearchRoundsView;
  const controlRoom = buildProjectControlRoom({
    project: p,
    runs: detail.runs,
    items: items ?? [],
    candidateCount: p.candidates_total,
    hasFilter: statusFilter !== "all",
    hasCandidateDecisionQueuePanel: Boolean(items && items.length > 0),
    hasResearchRoundsPanel: projectRounds.items.length > 0,
    hasSearchConstraintDiffPanel: true,
    hasProjectHeaderBrief: Boolean((p.brief ?? "").trim()),
    hasCandidateFeedbackSignalsPanel: !projectConsole.candidateFeedbackSignals.empty,
    locale,
  }) as ProjectControlRoomView;
  const projectHierarchy = buildProjectDetailHierarchy({
    hasCandidates: Boolean(items && items.length > 0),
    hasControlRoom: true,
    hasProjectEvidenceMatrix: Boolean(projectEvidenceMatrix),
    hasStatusFunnel: p.candidates_total > 0,
    hasResearchRounds: projectRounds.items.length > 0,
    hasSearchConsolePriorities: projectConsole.priorities.items.length > 0,
    hasResearchRoundFeedback: projectRounds.items.some((round) => Boolean(round.feedbackSummary)),
    hasSearchConsoleFeedback: Boolean(projectConsole.feedback && projectConsole.feedback.items.length > 0),
    hasConstraintDiffRefinements: projectConsole.constraintDiff.changes.some((change) => change.sourceLabel === projectConsole.refinementSuggestions.title),
    hasSearchRefinementSuggestions: projectConsole.refinementSuggestions.items.length > 0,
    hasConstraintDiffCandidateFeedback: projectConsole.constraintDiff.changes.some((change) => change.sourceLabel === projectConsole.candidateFeedbackSignals.title),
    hasCandidateFeedbackSignals: !projectConsole.candidateFeedbackSignals.empty,
    hasHeaderBrief: Boolean((p.brief ?? "").trim()),
    hasSearchConsoleBrief: Boolean(projectConsole.briefText.trim()),
    hasCandidateStatusTabs: Boolean(items && items.length > 0),
    locale,
  }) as ProjectDetailHierarchyView;
  const hiddenPanels = new Set(projectHierarchy.hidden);
  const showKpiStrip = !hiddenPanels.has("kpi_strip");
  const showActionBrief = !hiddenPanels.has("action_brief");
  const showCandidateFeedbackSummary = !hiddenPanels.has("candidate_feedback_summary");
  const showCandidateEvidencePriority = !hiddenPanels.has("candidate_evidence_priority");
  const showCandidateComparison = !hiddenPanels.has("candidate_comparison");
  const showLatestRoundSummary = !hiddenPanels.has("latest_round_summary");
  const showSearchConsolePriorities = !hiddenPanels.has("search_console_priorities");
  const showSearchConsoleFeedback = !hiddenPanels.has("search_console_feedback");
  const showSearchRefinementSuggestions = !hiddenPanels.has("search_refinement_suggestions");
  const showCandidateFeedbackSignals = !hiddenPanels.has("candidate_feedback_signals");
  const showSearchConsoleBrief = !hiddenPanels.has("search_console_brief");
  const showCandidateStatusTabs = !hiddenPanels.has("candidate_status_tabs");
  const decisionQueue = buildProjectCandidateDecisionQueue({ items: items ?? [], locale });
  const actionBrief = showActionBrief ? buildProjectActionBrief({ items: items ?? [], locale }) as ProjectActionBriefView : null;
  const candidateFeedbackSummary = showCandidateFeedbackSummary ? buildProjectCandidateFeedbackSummary({ items: items ?? [], locale }) as ProjectCandidateFeedbackSummaryView : null;

  return (
    <div className="space-y-6">
      <SecondaryAction href="/app/projects" className="min-h-9 px-3 py-2 text-xs">
        <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        回项目列表
      </SecondaryAction>

      {/* 头部: name + brief 编辑 + 状态 + 删除 */}
      <ProjectHeader key={`${p.id}:${p.name}:${p.brief ?? ""}`} detail={detail} onChanged={reloadDetail} onDelete={deleteProject} />

      <ProjectControlRoomPanel
        room={controlRoom}
        searchHref={searchHref}
        projectId={id}
        onOpenCandidate={(itemId) => setSelectedItemId(itemId)}
      />

      {actionBrief && (
        <ProjectActionBriefPanel
          brief={actionBrief}
          searchHref={searchHref}
          projectId={id}
          locale={locale}
          onOpenCandidate={(itemId) => setSelectedItemId(itemId)}
        />
      )}

      {items && items.length > 0 && candidateFeedbackSummary && (
        <ProjectCandidateFeedbackSummaryPanel summary={candidateFeedbackSummary} />
      )}

      <ProjectSearchConsolePanel
        consoleView={projectConsole}
        searchHref={searchHref}
        verifyHref={verifyHref}
        showLatestRoundSummary={showLatestRoundSummary}
        showPriorities={showSearchConsolePriorities}
        showFeedback={showSearchConsoleFeedback}
        showRefinementSuggestions={showSearchRefinementSuggestions}
        showCandidateFeedbackSignals={showCandidateFeedbackSignals}
        showBrief={showSearchConsoleBrief}
      />

      {showKpiStrip && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label="候选人" value={p.candidates_total} sub="人" />
          {SHORT_STATUS.map((s) => (
            <KpiCard
              key={s.value}
              label={t(s.labelKey)}
              value={detail.breakdown[s.value] ?? 0}
              sub="人"
              accentDot={s.dot}
              onClick={() => setStatusFilter(s.value)}
            />
          ))}
        </section>
      )}

      <StatusFunnel breakdown={detail.breakdown} total={p.candidates_total} current={statusFilter} onClick={setStatusFilter} />
      {items && items.length > 0 && (
        <ProjectCandidateDecisionQueuePanel
          queue={decisionQueue}
          locale={locale}
          projectId={id}
          selectedItemId={selectedItemId}
          onOpenCandidate={(itemId) => setSelectedItemId(itemId)}
        />
      )}

      {/* 候选人列表 + 详情面板 */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold text-gray-700">候选人</h2>
          {items && items.length > 0 && showCandidateStatusTabs && (
            <SegmentedControl
              value={statusFilter}
              onChange={setStatusFilter}
              items={[
                { value: "all", label: t("common.all"), count: items.length },
                ...SHORT_STATUS
                  .filter((s) => (detail.breakdown[s.value] ?? 0) > 0 || statusFilter === s.value)
                  .map((s) => ({ value: s.value, label: t(s.labelKey), count: detail.breakdown[s.value] ?? 0 })),
              ]}
            />
          )}
        </div>

        {items === null && (
          <LoadingState title="正在加载候选人" description="正在同步本项目下的候选人状态和证据画像。" />
        )}
        {items && items.length === 0 && (
          <EmptyState title="本项目还没有候选人" description="先在本项目下启动一次搜人，候选人会自动回到这个项目空间。" />
        )}
        {items && items.length > 0 && (
          <div className="space-y-4">
            {projectEvidencePriorityView && showCandidateEvidencePriority && (
              <EvidencePriorityPanel
                view={projectEvidencePriorityView}
                compact
                locale={locale}
                onOpenCandidate={(priorityItem) => {
                  const item = filteredItems[priorityItem.candidate_index];
                  if (item) setSelectedItemId(item.id);
                }}
              />
            )}
            {projectEvidenceMatrix && (
              <ProjectEvidenceMatrixPanel
                matrix={projectEvidenceMatrix}
                projectId={id}
                selectedItemId={selectedItemId}
                onOpenCandidate={(itemId) => setSelectedItemId(itemId)}
              />
            )}
            {showCandidateComparison && <CandidateComparisonView result={projectComparisonResult} locale={locale} />}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
              <ul className="space-y-2">
                {filteredItems.map((it) => (
                  <CandidateItem key={it.id} item={it} locale={locale} selected={selectedItemId === it.id} onClick={() => setSelectedItemId(it.id)} />
                ))}
                {filteredItems.length === 0 && (
                  <li><EmptyState title="这个状态下没有候选人" description="切换状态筛选，或继续补充候选人。" /></li>
                )}
              </ul>
              <div className="lg:sticky lg:top-6 lg:self-start">
                {selectedItem ? (
                  <CandidateDetailPanel
                    key={selectedItem.id}
                    item={selectedItem}
                    locale={locale}
                    onChanged={(patch) => {
                      setItems((prev) => prev?.map((it) => it.id === selectedItem.id ? { ...it, ...patch } : it) ?? prev);
                      reloadDetail();
                    }}
                    onDeleted={() => {
                      setItems((prev) => prev?.filter((it) => it.id !== selectedItem.id) ?? prev);
                      setSelectedItemId(null);
                      reloadDetail();
                    }}
                    onUnassigned={() => {
                      setItems((prev) => prev?.filter((it) => it.id !== selectedItem.id) ?? prev);
                      setSelectedItemId(null);
                      reloadDetail();
                    }}
                  />
                ) : (
                  <div className="rounded-3xl border border-dashed border-black/10 bg-white/80 p-5 text-sm text-[var(--sh-muted)]">
                    点左侧候选人查看画像、切状态、写备注。
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      <ProjectResearchRoundsPanel rounds={projectRounds} projectId={id} />
    </div>
  );
}

function ProjectSearchConsolePanel({
  consoleView,
  searchHref,
  verifyHref,
  showLatestRoundSummary,
  showPriorities,
  showFeedback,
  showRefinementSuggestions,
  showCandidateFeedbackSignals,
  showBrief,
}: {
  consoleView: ProjectSearchConsoleView;
  searchHref: string;
  verifyHref: string;
  showLatestRoundSummary: boolean;
  showPriorities: boolean;
  showFeedback: boolean;
  showRefinementSuggestions: boolean;
  showCandidateFeedbackSignals: boolean;
  showBrief: boolean;
}) {
  const { t } = useI18n();
  const showFeedbackPanel = showFeedback || (showCandidateFeedbackSignals && !consoleView.candidateFeedbackSignals.empty);
  const gridClassName = showLatestRoundSummary && showFeedbackPanel
    ? "mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)_minmax(260px,0.85fr)]"
    : showLatestRoundSummary || showFeedbackPanel
      ? "mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]"
      : "mt-5 grid gap-3";
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{consoleView.title}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{consoleView.briefTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{consoleView.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <PrimaryAction href={searchHref}>
            <FiSearch className="h-4 w-4" aria-hidden="true" />
            {t("projects.searchInProject")}
          </PrimaryAction>
          <SecondaryAction href={verifyHref}>
            <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
            {t("projects.verifyInProject")}
          </SecondaryAction>
        </div>
      </div>

      <div className={gridClassName}>
        <div className="rounded-2xl border border-black/10 bg-white/72 p-4">
          {showBrief && (
            <>
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{consoleView.briefTitle}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--sh-ink)]">{consoleView.briefText}</p>
            </>
          )}
          <div className={showBrief ? "mt-4 rounded-2xl bg-[var(--sh-canvas)] px-3 py-3" : "rounded-2xl bg-[var(--sh-canvas)] px-3 py-3"}>
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("projects.console.nextSearchTitle")}</p>
            <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs leading-5 text-[var(--sh-ink)]">{consoleView.nextSearchInput}</p>
          </div>
          <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{consoleView.constraintDiff.title}</p>
              <p className="text-[11px] text-[var(--sh-faint)]">{consoleView.constraintDiff.editableHint}</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-[var(--sh-canvas)] px-3 py-2">
                <p className="text-[11px] font-semibold text-[var(--sh-muted)]">{consoleView.constraintDiff.originalTitle}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 text-[var(--sh-ink)]">{consoleView.constraintDiff.originalInput}</p>
              </div>
              <div className="rounded-xl bg-[var(--sh-canvas)] px-3 py-2">
                <p className="text-[11px] font-semibold text-[var(--sh-muted)]">{consoleView.constraintDiff.optimizedTitle}</p>
                <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-5 text-[var(--sh-ink)]">{consoleView.constraintDiff.optimizedInput}</p>
              </div>
            </div>
            {consoleView.constraintDiff.changes.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {consoleView.constraintDiff.changes.map((change, index) => (
                  <span key={`${change.sourceLabel}:${change.key}:${index}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[var(--sh-ink)] ring-1 ring-black/10">
                    <span className="text-[var(--sh-muted)]">{change.typeLabel}</span>
                    <span className="truncate">{change.label}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {showRefinementSuggestions && consoleView.refinementSuggestions.items.length > 0 && (
            <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-3">
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{consoleView.refinementSuggestions.title}</p>
              <div className="mt-2 space-y-2">
                {consoleView.refinementSuggestions.items.map((item) => (
                  <div key={item.key} className="rounded-xl bg-[var(--sh-canvas)] px-3 py-2">
                    <p className="text-xs font-semibold text-[var(--sh-ink)]">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {showLatestRoundSummary && (
          <div className="rounded-2xl border border-black/10 bg-white/72 p-4">
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{consoleView.latestRoundTitle}</p>
            {consoleView.latestRound ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">#{consoleView.latestRound.roundNumber}</span>
                  <KindBadge kind={consoleView.latestRound.kind} />
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">{consoleView.latestRound.badge}</span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-[var(--sh-ink)]">{consoleView.latestRound.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{consoleView.latestRound.description}</p>
                {(consoleView.latestRound.summary || consoleView.latestRound.status) && (
                  <p className="mt-2 text-xs text-[var(--sh-faint)]">{consoleView.latestRound.summary || consoleView.latestRound.status}</p>
                )}
              </>
            ) : (
              <p className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/60 px-3 py-3 text-xs leading-5 text-[var(--sh-faint)]">{consoleView.latestRoundEmpty}</p>
            )}
          </div>
        )}

        {showFeedbackPanel && (
          <div className="rounded-2xl border border-black/10 bg-white/72 p-4">
            {showFeedback && (
              <>
                <p className="text-xs font-semibold text-[var(--sh-muted)]">{consoleView.feedback?.title ?? t("projects.console.feedbackTitle")}</p>
                {consoleView.feedback && consoleView.feedback.items.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {consoleView.feedback.items.map((item) => (
                      <span key={item.key} className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                        {item.label}: {item.value}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/60 px-3 py-3 text-xs leading-5 text-[var(--sh-faint)]">{t("projects.console.feedbackEmpty")}</p>
                )}
              </>
            )}
            {showCandidateFeedbackSignals && !consoleView.candidateFeedbackSignals.empty && (
              <div className={showFeedback ? "mt-3 rounded-2xl border border-blue-100 bg-blue-50/55 p-3" : "rounded-2xl border border-blue-100 bg-blue-50/55 p-3"}>
                <p className="text-xs font-semibold text-blue-700">{consoleView.candidateFeedbackSignals.title}</p>
                <div className="mt-2 space-y-2">
                  {consoleView.candidateFeedbackSignals.items.map((item) => (
                    <div key={item.key} className="rounded-xl bg-white/78 px-3 py-2 ring-1 ring-blue-100">
                      <p className="text-xs font-semibold text-blue-800">{item.label}</p>
                      <p className="mt-1 text-xs leading-5 text-blue-700">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showPriorities && consoleView.priorities.items.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{consoleView.priorities.title}</p>
          <div className="mt-2 grid gap-3 md:grid-cols-3">
            {consoleView.priorities.items.map((action) => (
              <div key={action.key} className="rounded-2xl border border-black/10 bg-white/72 p-4">
                <p className="text-sm font-semibold text-[var(--sh-ink)]">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{action.detail}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Surface>
  );
}

function ProjectControlRoomPanel({
  room,
  searchHref,
  projectId,
  onOpenCandidate,
}: {
  room: ProjectControlRoomView;
  searchHref: string;
  projectId: string;
  onOpenCandidate: (itemId: string) => void;
}) {
  const focusBackfillHref = room.focus.backfillInput
    ? `/app/search?project=${projectId}&q=${encodeURIComponent(room.focus.backfillInput)}`
    : "";
  const cardGridClassName = room.cards.length >= 5
    ? "md:grid-cols-5"
    : room.cards.length === 4
      ? "md:grid-cols-4"
      : "md:grid-cols-3";
  return (
    <Surface className="p-5 md:p-6">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{room.title}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--sh-ink)]">{room.focus.label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{room.description}</p>
        </div>
        <div className="rounded-2xl bg-[var(--sh-canvas)] p-4">
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{room.focusTitle}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--sh-ink)]">{room.focus.detail}</p>
          {room.focus.actionDetail && <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{room.focus.actionDetail}</p>}
          <div className="mt-3">
            {focusBackfillHref ? (
              <PrimaryAction href={focusBackfillHref}>
                <FiAlertTriangle className="h-4 w-4" aria-hidden="true" />
                {room.focus.label}
              </PrimaryAction>
            ) : room.focus.targetItemId ? (
              <PrimaryAction onClick={() => onOpenCandidate(room.focus.targetItemId)}>
                <FiAlertTriangle className="h-4 w-4" aria-hidden="true" />
                {room.focus.label}
              </PrimaryAction>
            ) : (
              <PrimaryAction href={searchHref}>
                <FiSearch className="h-4 w-4" aria-hidden="true" />
                {room.focus.label}
              </PrimaryAction>
            )}
          </div>
          {room.nextSteps.actions.length > 0 && (
            <div className="mt-4 border-t border-black/10 pt-3">
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{room.nextSteps.title}</p>
              <ul className="mt-2 space-y-2">
                {room.nextSteps.actions.map((action) => (
                  <li key={action.key} className="rounded-xl bg-white/68 px-3 py-2 ring-1 ring-black/5">
                    <p className="text-xs font-semibold text-[var(--sh-ink)]">{action.label}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--sh-muted)]">{action.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <dl className={`mt-5 grid overflow-hidden rounded-2xl border border-black/10 bg-white/70 ${cardGridClassName}`}>
        {room.cards.map((card, index) => (
          <div key={card.key} className={`p-4 ${index > 0 ? "border-t border-black/10 md:border-l md:border-t-0" : ""}`}>
            <dt className="text-xs font-semibold text-[var(--sh-muted)]">{card.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums text-[var(--sh-ink)]">{card.value}</dd>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--sh-muted)]">{card.detail}</p>
          </div>
        ))}
      </dl>
    </Surface>
  );
}

function ProjectResearchRoundsPanel({
  rounds,
  projectId,
}: {
  rounds: ProjectResearchRoundsView;
  projectId: string;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.rounds.eyebrow")}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{rounds.title} ({rounds.items.length})</h2>
        </div>
      </div>
      {rounds.items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-3 text-sm text-[var(--sh-faint)]">{rounds.emptyText}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rounds.items.map((round) => {
            const continueHref = round.kind === "search" && round.nextSearchInput
              ? `/app/search?project=${projectId}&q=${encodeURIComponent(round.nextSearchInput)}`
              : "";
            const reportHref = `/r/${round.id}`;
            return (
              <li key={round.id} className="rounded-3xl border border-black/10 bg-white/84 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">#{round.roundNumber}</span>
                      <KindBadge kind={round.kind} />
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">{round.badge}</span>
                    </div>
                    <p className="mt-3 truncate text-sm font-semibold text-[var(--sh-ink)]" title={round.queryText}>{round.label}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{round.description}</p>
                    {(round.summary || round.status) && (
                      <p className="mt-2 text-xs text-[var(--sh-faint)]">{round.summary || round.status}</p>
                    )}
                    {round.feedbackSummary && (
                      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
                        <p className="text-xs font-semibold text-blue-700">{round.feedbackSummary.title}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {round.feedbackSummary.items.map((item) => (
                            <span key={item.key} className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-blue-100">
                              {item.label}: {item.value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {continueHref && (
                      <SecondaryAction href={continueHref} className="min-h-9 px-3 py-2 text-xs">
                        <FiRefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("projects.rounds.nextSearch")}
                      </SecondaryAction>
                    )}
                    {round.status === "done" && (
                      <SecondaryAction href={reportHref} className="min-h-9 px-3 py-2 text-xs">
                        <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("projects.rounds.viewReport")}
                      </SecondaryAction>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Surface>
  );
}

function KindBadge({ kind }: { kind: "search" | "verify" }) {
  const { t } = useI18n();
  if (kind === "search") return <StatusBadge label={t("projects.kind.search")} dotClassName="bg-blue-500" className="bg-blue-50 text-blue-700 ring-blue-100" />;
  return <StatusBadge label={t("projects.kind.verify")} dotClassName="bg-amber-500" className="bg-amber-50 text-amber-800 ring-amber-100" />;
}

function StatusFunnel({
  breakdown,
  total,
  current,
  onClick,
}: {
  breakdown: Record<ShortlistStatus, number>;
  total: number;
  current: ShortlistStatus | "all";
  onClick: (v: ShortlistStatus | "all") => void;
}) {
  const { t } = useI18n();
  if (total === 0) return null;
  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">候选人漏斗</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">状态漏斗</h2>
        </div>
        <button
          type="button"
          onClick={() => onClick("all")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            current === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {t("common.all")} {total}
        </button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {SHORT_STATUS.map((status) => {
          const count = breakdown[status.value] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const active = current === status.value;
          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onClick(status.value)}
              className={`rounded-2xl border p-3 text-left transition ${
                active ? "border-[var(--sh-ink)] bg-white shadow-sm" : "border-black/10 bg-white/70 hover:border-black/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {t(status.labelKey)}
                </span>
                <span className="text-xs tabular-nums text-gray-400">{pct}%</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{count}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${status.dot}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}

function ProjectActionBriefPanel({
  brief,
  searchHref,
  projectId,
  locale,
  onOpenCandidate,
}: {
  brief: ProjectActionBriefView;
  searchHref: string;
  projectId: string;
  locale: "zh" | "en";
  onOpenCandidate: (itemId: string) => void;
}) {
  const primary = brief.primaryAction;
  const primaryBackfillHref = primary.backfillInput
    ? `/app/search?project=${projectId}&q=${encodeURIComponent(primary.backfillInput)}`
    : "";
  const canOpenPrimary = Boolean(primary.targetItemId);
  const secondaryActions = brief.actions.filter((action) => action.key !== primary.key).slice(0, 3);
  const copy = locale === "en"
    ? { eyebrow: "Workbench", start: "Start search" }
    : { eyebrow: "Workbench", start: "启动搜人" };

  return (
    <Surface className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{copy.eyebrow}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--sh-ink)]">{brief.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{brief.summary}</p>
        </div>
        <div className="shrink-0">
          {primaryBackfillHref ? (
            <PrimaryAction href={primaryBackfillHref}>
              <FiAlertTriangle className="h-4 w-4" aria-hidden="true" />
              {primary.label}
            </PrimaryAction>
          ) : canOpenPrimary ? (
            <PrimaryAction onClick={() => onOpenCandidate(primary.targetItemId)}>
              <FiAlertTriangle className="h-4 w-4" aria-hidden="true" />
              {primary.label}
            </PrimaryAction>
          ) : (
            <PrimaryAction href={searchHref}>
              <FiSearch className="h-4 w-4" aria-hidden="true" />
              {primary.label || copy.start}
            </PrimaryAction>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="rounded-2xl bg-white/80 p-4 ring-1 ring-black/5">
          <p className="text-sm font-semibold text-gray-900">{primary.label}</p>
          <p className="mt-1 text-sm leading-6 text-gray-600">{primary.detail}</p>
        </div>
        {secondaryActions.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {secondaryActions.map((action) => (
              <button
                key={action.key}
                type="button"
                onClick={() => action.targetItemId && onOpenCandidate(action.targetItemId)}
                disabled={!action.targetItemId}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-2.5 text-left ring-1 ring-black/5 transition hover:bg-white disabled:cursor-default disabled:opacity-70"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900">{action.label}</span>
                  <span className="block truncate text-xs text-gray-500">{action.detail}</span>
                </span>
                {typeof action.count === "number" && (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-600">{action.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Surface>
  );
}

function ProjectCandidateFeedbackSummaryPanel({
  summary,
}: {
  summary: ProjectCandidateFeedbackSummaryView;
}) {
  return (
    <Surface className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--sh-ink)]">{summary.title}</h2>
            {!summary.empty && (
              <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">
                {summary.reviewedCount}
              </span>
            )}
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{summary.summary}</p>
        </div>
        <p className="max-w-sm rounded-2xl bg-[var(--sh-canvas)] px-3 py-3 text-xs leading-5 text-[var(--sh-muted)]">
          {summary.nextSearchHint}
        </p>
      </div>

      {summary.items.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {summary.items.map((item) => (
            <div key={item.key} className="rounded-2xl border border-black/10 bg-white/76 p-4">
              <p className="text-sm font-semibold text-[var(--sh-ink)]">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}

function ProjectCandidateDecisionQueuePanel({
  queue,
  locale,
  projectId,
  selectedItemId,
  onOpenCandidate,
}: {
  queue: {
    columns: Array<{
      key: string;
      title: string;
      count: number;
      items: Array<{
        id: string;
        name: string;
        subtitle: string;
        matchScore: number | null;
        reason: string;
        canBackfill?: boolean;
        backfillInput?: string;
      }>;
    }>;
  };
  locale: "zh" | "en";
  projectId: string;
  selectedItemId: string | null;
  onOpenCandidate: (itemId: string) => void;
}) {
  const copy = locale === "en"
    ? {
        eyebrow: "Decision queue",
        title: "Candidate decision queue",
        description: "Grouped by review, active progress, evidence gaps, and not-a-fit so teams can handle the highest-risk candidates first.",
        backfill: "Backfill evidence",
        overflow: "more candidates. Use the list below to keep reviewing.",
        empty: "No candidates",
      }
    : {
        eyebrow: "Decision queue",
        title: "候选人决策队列",
        description: "按待看、推进中、需补证据和不合适分组，先处理证据风险和高意向候选人。",
        backfill: "补搜证据",
        overflow: "位，切换下方列表继续查看。",
        empty: "暂无候选人",
      };
  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{copy.eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{copy.title}</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--sh-muted)]">
          {copy.description}
        </p>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-4">
        {queue.columns.map((column) => (
          <section key={column.key} className="rounded-3xl border border-black/10 bg-white/72 p-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900">{column.title}</h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-gray-600">{column.count}</span>
            </div>
            <div className="mt-3 space-y-2">
              {column.items.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  className={`rounded-2xl border p-3 transition ${
                    selectedItemId === item.id ? "border-[var(--sh-ink)] bg-white shadow-sm" : "border-black/10 bg-white/78 hover:border-black/20"
                  }`}
                >
                  <button type="button" onClick={() => onOpenCandidate(item.id)} className="w-full text-left">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                        {item.subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{item.subtitle}</p>}
                      </div>
                      {typeof item.matchScore === "number" && (
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-gray-700">{item.matchScore}</span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-gray-500">{item.reason}</p>
                  </button>
                  {item.canBackfill && item.backfillInput && (
                    <Link
                      href={`/app/search?project=${projectId}&q=${encodeURIComponent(item.backfillInput)}`}
                      className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                    >
                      {copy.backfill}
                    </Link>
                  )}
                </div>
              ))}
              {column.items.length > 6 && (
                <p className="px-1 text-xs text-gray-400">
                  {locale === "en" ? `${column.items.length - 6} ${copy.overflow}` : `还有 ${column.items.length - 6} ${copy.overflow}`}
                </p>
              )}
              {column.items.length === 0 && (
                <p className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-3 text-xs leading-5 text-gray-400">{copy.empty}</p>
              )}
            </div>
          </section>
        ))}
      </div>
    </Surface>
  );
}

function evidenceQualityClass(value: string) {
  if (value === "high") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (value === "low") return "bg-red-50 text-red-700 ring-red-100";
  return "bg-amber-50 text-amber-800 ring-amber-100";
}

function priorityClass(value: string) {
  if (value === "risk_review") return "bg-red-50 text-red-700 ring-red-100";
  if (value === "ready_to_review") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  return "bg-amber-50 text-amber-800 ring-amber-100";
}

function ProjectEvidenceMatrixPanel({
  matrix,
  projectId,
  selectedItemId,
  onOpenCandidate,
}: {
  matrix: ProjectEvidenceMatrixView;
  projectId: string;
  selectedItemId: string | null;
  onOpenCandidate: (itemId: string) => void;
}) {
  if (matrix.empty) return null;
  const { t } = useI18n();
  const summary = [
    { label: t("projects.evidenceMatrix.summary.total"), value: matrix.summary.total },
    { label: t("projects.evidenceMatrix.summary.active"), value: matrix.summary.active },
    { label: t("projects.evidenceMatrix.summary.risk"), value: matrix.summary.risk_review },
    { label: t("projects.evidenceMatrix.summary.needsBackfill"), value: matrix.summary.needs_backfill },
    { label: t("projects.evidenceMatrix.summary.ready"), value: matrix.summary.ready_to_review },
    { label: t("projects.evidenceMatrix.summary.rejected"), value: matrix.summary.rejected },
  ];
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--sh-ink)]">{matrix.title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{matrix.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {summary.map((item) => (
            <span key={item.label} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-600 ring-1 ring-black/10">
              {item.label} {item.value}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs font-semibold text-gray-400">
              <th className="border-b border-gray-100 px-3 py-2">{t("projects.evidenceMatrix.column.candidate")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{t("projects.evidenceMatrix.column.status")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{t("projects.evidenceMatrix.column.match")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{t("projects.evidenceMatrix.column.evidence")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{t("projects.evidenceMatrix.column.sources")}</th>
              <th className="border-b border-gray-100 px-3 py-2 text-right">{t("projects.evidenceMatrix.column.checks")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{t("projects.evidenceMatrix.column.priority")}</th>
              <th className="border-b border-gray-100 px-3 py-2">{t("projects.evidenceMatrix.column.next")}</th>
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map((row) => (
              <tr key={row.id} className={`align-top ${selectedItemId === row.id ? "bg-blue-50/40" : ""}`}>
                <td className="border-b border-gray-100 px-3 py-3">
                  <button type="button" onClick={() => onOpenCandidate(row.id)} className="max-w-[220px] text-left">
                    <p className="truncate font-semibold text-gray-900">{row.name}</p>
                    {row.role && <p className="mt-0.5 truncate text-xs text-gray-500">{row.role}</p>}
                  </button>
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{row.status_label}</span>
                </td>
                <td className="border-b border-gray-100 px-3 py-3 text-right font-semibold tabular-nums text-gray-900">{row.match_score}</td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${evidenceQualityClass(row.evidence_quality)}`}>{row.evidence_quality}</span>
                </td>
                <td className="border-b border-gray-100 px-3 py-3 text-right tabular-nums text-gray-700">{row.independent_sources}</td>
                <td className="border-b border-gray-100 px-3 py-3 text-right text-xs tabular-nums text-gray-600">
                  {row.verified_count} / {row.unverified_count} / {row.contradicted_count}
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${priorityClass(row.priority)}`}>{row.priority_label}</span>
                </td>
                <td className="border-b border-gray-100 px-3 py-3">
                  <p className="max-w-[280px] text-xs leading-5 text-gray-500">{row.decision_hint}</p>
                  {row.action.search_input ? (
                    <Link
                      href={`/app/search?project=${projectId}&q=${encodeURIComponent(row.action.search_input)}`}
                      className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                    >
                      {row.action.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenCandidate(row.id)}
                      className="mt-2 inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 ring-1 ring-black/10 transition hover:bg-gray-50"
                    >
                      {row.action.label}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

function KpiCard({ label, value, sub, accentDot, onClick }: { label: string; value: number; sub: string; accentDot?: string; onClick?: () => void }) {
  const inner = (
    <div className="rounded-3xl border border-black/10 bg-white/82 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        {accentDot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${accentDot}`} />}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[var(--sh-ink)]">{value}</p>
      <p className="text-xs text-[var(--sh-faint)]">{sub}</p>
    </div>
  );
  if (onClick) return <button onClick={onClick} className="text-left">{inner}</button>;
  return inner;
}

function ProjectHeader({ detail, onChanged, onDelete }: { detail: ProjectDetail; onChanged: () => void; onDelete: () => void }) {
  const p = detail.project;
  const { t } = useI18n();
  const [editingName, setEditingName] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [name, setName] = useState(p.name);
  const [brief, setBrief] = useState(p.brief ?? "");

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) onChanged();
  }

  async function saveName() {
    setEditingName(false);
    if (name.trim() && name !== p.name) await patch({ name: name.trim() });
    else setName(p.name);
  }
  async function saveBrief() {
    setEditingBrief(false);
    if (brief !== (p.brief ?? "")) await patch({ brief: brief.trim() || null });
  }

  const meta = PROJ_STATUS_META[p.status];

  return (
    <Surface className="space-y-5 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">项目工作台</p>
          {editingName ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(p.name); setEditingName(false); }}}
              autoFocus
              maxLength={120}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)] outline-none focus:border-black/20 md:text-5xl"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="mt-2 cursor-text rounded-2xl text-3xl font-semibold tracking-tight text-[var(--sh-ink)] hover:bg-neutral-100 md:text-5xl"
              title="点击编辑"
            >
              {p.name}
            </h1>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={p.status}
            onChange={(e) => patch({ status: e.target.value })}
            className={`appearance-none rounded-full px-3 py-1.5 text-xs font-semibold ring-1 outline-none ${meta.chip}`}
          >
            <option value="open">{t(PROJ_STATUS_META.open.labelKey)}</option>
            <option value="paused">{t(PROJ_STATUS_META.paused.labelKey)}</option>
            <option value="closed">{t(PROJ_STATUS_META.closed.labelKey)}</option>
          </select>
          <IconButton label="删除项目" onClick={onDelete} Icon={FiTrash2} tone="danger" />
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">招聘需求 / brief</span>
          {!editingBrief && <button onClick={() => setEditingBrief(true)} className="text-xs font-semibold text-[var(--sh-muted)] hover:text-[var(--sh-ink)]">{p.brief ? "编辑" : "添加"}</button>}
        </div>
        {editingBrief ? (
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={saveBrief}
            autoFocus
            rows={4}
            placeholder="粘贴 JD, 或一句话描述要找什么样的人。"
            className="block w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20"
          />
        ) : (
          <p className={`whitespace-pre-line text-sm leading-6 ${p.brief ? "text-[var(--sh-muted)]" : "italic text-[var(--sh-faint)]"}`}>
            {p.brief || "暂无 brief — 加上之后, 在本项目下搜人会预填它"}
          </p>
        )}
      </div>
    </Surface>
  );
}

function CandidateItem({ item, locale, selected, onClick }: { item: ShortlistItem; locale: "zh" | "en"; selected: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const c = asCandidate(item.candidate);
  const subtitle = [c.current_role, c.current_company].filter(Boolean).join(" · ") || c.headline || "";
  const status = SHORT_STATUS.find((s) => s.value === item.status) ?? SHORT_STATUS[0];
  const signal = buildCandidateDecisionSignal({ candidate: item.candidate, locale, status: item.status });
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full flex-col gap-2 rounded-3xl border bg-white/84 p-4 text-left transition ${
          selected ? "border-[var(--sh-ink)] shadow-[0_18px_48px_rgba(0,0,0,0.08)]" : "border-black/10 hover:border-black/20"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{c.name || "(无名)"}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge label={t(status.labelKey)} dotClassName={status.dot} className={status.chip} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[signal.match, signal.evidence, signal.sources].map((metric) => (
            <span key={metric.key} className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
              <span className="block text-[11px] font-medium text-gray-500">{metric.label}</span>
              <span className="mt-0.5 block text-xs font-semibold tabular-nums text-gray-900">{metric.value}</span>
            </span>
          ))}
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-gray-500">{signal.hint}</p>
        {item.notes && <p className="line-clamp-2 text-xs text-gray-600">备注：{item.notes}</p>}
      </button>
    </li>
  );
}

function CandidateDetailPanel({
  item, onChanged, onDeleted, onUnassigned, locale,
}: {
  item: ShortlistItem;
  onChanged: (patch: Partial<ShortlistItem>) => void;
  onDeleted: () => void;
  onUnassigned: () => void;
  locale: "zh" | "en";
}) {
  const { t } = useI18n();
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savedHint, setSavedHint] = useState(false);
  const [savingFeedback, setSavingFeedback] = useState("");
  const [outreachOpen, setOutreachOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "更新失败");
  }

  async function setStatus(next: ShortlistStatus) {
    if (next === item.status || savingStatus) return;
    setSavingStatus(true);
    const prev = item.status;
    onChanged({ status: next });
    try { await patch({ status: next }); } catch { onChanged({ status: prev }); } finally { setSavingStatus(false); }
  }

  const saveNotes = useCallback(async (v: string) => {
    try { await patch({ notes: v }); onChanged({ notes: v }); setSavedHint(true); setTimeout(() => setSavedHint(false), 1500); } catch {}
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onNotesChange(v: string) {
    setNotes(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(v), 800);
  }

  async function setCandidateFeedback(group: string, value: string) {
    const prevCandidate = item.candidate;
    const nextFeedback = { ...candidateFeedback(prevCandidate), [group]: value };
    const nextCandidate = candidateWithFeedback(prevCandidate, nextFeedback);
    setSavingFeedback(`${group}:${value}`);
    onChanged({ candidate: nextCandidate });
    try {
      await patch({ candidate: nextCandidate });
    } catch {
      onChanged({ candidate: prevCandidate });
    } finally {
      setSavingFeedback("");
    }
  }

  async function handleDelete() {
    if (!confirm("把这个候选人移出候选池?")) return;
    const r = await fetch(`/api/shortlist/${item.id}`, { method: "DELETE" });
    if (r.ok) onDeleted();
  }

  async function unassignFromProject() {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: null }),
    });
    if (r.ok) onUnassigned();
  }

  const candidate = item.candidate;
  const isTalent = isTalentShape(candidate);
  const feedbackPanel = buildCandidateFeedbackPanel({ candidate, feedback: candidateFeedback(candidate), locale });
  const feedbackCopy = locale === "en"
    ? {
        saved: "Saved into next-round search signals.",
      }
    : {
        saved: "会同步到下一轮搜索优化。",
      };

  return (
    <Surface className="space-y-4 p-5">
      {/* 状态切换 + 工具栏 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SHORT_STATUS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            disabled={savingStatus}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
              item.status === s.value ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={unassignFromProject} className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">移出项目</button>
        <IconButton label="删除候选人" onClick={handleDelete} Icon={FiTrash2} tone="danger" />
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/78 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{feedbackPanel.title}</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">{feedbackPanel.description}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">{feedbackCopy.saved}</span>
        </div>
        <div className="mt-4 space-y-3">
          {feedbackPanel.groups.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-semibold text-gray-500">{group.label}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.options.map((option) => {
                  const saving = savingFeedback === `${group.key}:${option.value}`;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={Boolean(savingFeedback)}
                      onClick={() => setCandidateFeedback(group.key, option.value)}
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                        option.selected
                          ? "bg-gray-900 text-white"
                          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
                      }`}
                    >
                      {saving ? "..." : option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() => setOutreachOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sh-ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
      >
        <FiMail className="h-4 w-4" aria-hidden="true" />
        AI 起草外联邮件
      </button>
      <OutreachModal
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        candidate={candidate}
        candidateName={asCandidate(candidate).name}
      />

      {/* 备注 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">备注</label>
          <span className="text-[11px] text-gray-400">{savedHint ? "已保存" : "自动保存"}</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="第一次约见印象 / 你想问的问题 / 候选人对项目的反应…"
          className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:bg-white"
        />
      </div>

      <div className="text-xs text-gray-500">添加于 {new Date(item.created_at).toLocaleString("zh-CN")}</div>

      <div className="border-t border-gray-100 pt-4">
        {isTalent ? (
          <CandidateProfileView candidate={candidate as TalentCandidate} locale={locale} />
        ) : (
          <LegacyCandidateView candidate={candidate} />
        )}
      </div>
    </Surface>
  );
}

function LegacyCandidateView({ candidate }: { candidate: unknown }) {
  const c = asCandidate(candidate);
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-gray-900">{c.name || "(无名)"}</h2>
      {c.headline && <p className="text-gray-600">{c.headline}</p>}
    </div>
  );
}
