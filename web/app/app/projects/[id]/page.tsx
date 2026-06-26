"use client";

// /app/projects/[id] —— 招聘项目详情
// 头部 (name/brief 可编辑 + 状态 + 删除) + KPI + 候选人列表 (按 project 过滤) + 历史搜索
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FiAlertTriangle, FiArrowLeft, FiCheckCircle, FiClock, FiMail, FiPauseCircle, FiPlay, FiRefreshCw, FiSearch, FiSend, FiTrash2 } from "react-icons/fi";
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
type ShortlistStatus = "new" | "shortlisted" | "needs_evidence" | "outreach_drafted" | "passed" | "contacted" | "interviewing" | "hired" | "rejected";
type CandidateDisplayStatus = "new" | "shortlisted" | "needs_evidence" | "outreach_drafted" | "passed";
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

const SHORT_STATUS: { value: CandidateDisplayStatus; labelKey: string; chip: string; dot: string }[] = [
  { value: "new",          labelKey: "projects.detail.candidateStatus.new",          chip: "bg-gray-100 text-gray-700 ring-gray-200",        dot: "bg-gray-400" },
  { value: "shortlisted",  labelKey: "projects.detail.candidateStatus.shortlisted",  chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { value: "needs_evidence", labelKey: "projects.detail.candidateStatus.needsEvidence", chip: "bg-amber-50 text-amber-800 ring-amber-200", dot: "bg-amber-500" },
  { value: "outreach_drafted", labelKey: "projects.detail.candidateStatus.outreachDrafted", chip: "bg-blue-50 text-blue-700 ring-blue-200", dot: "bg-blue-500" },
  { value: "passed",       labelKey: "projects.detail.candidateStatus.passed",       chip: "bg-rose-50 text-rose-700 ring-rose-200",         dot: "bg-rose-400" },
];

function candidateDisplayStatus(status: ShortlistStatus): CandidateDisplayStatus {
  if (status === "contacted") return "outreach_drafted";
  if (status === "interviewing" || status === "hired") return "shortlisted";
  if (status === "rejected") return "passed";
  if (status === "shortlisted" || status === "needs_evidence" || status === "outreach_drafted" || status === "passed") return status;
  return "new";
}

type CandidateGraphView = {
  provider_status: Array<{ provider: "pdl"; enabled: boolean; reason: string }>;
  summary: {
    candidate_count: number;
    ready_for_outreach_count: number;
    needs_verification_count: number;
    interview_ready_count: number;
    source_count: number;
    contactable_count: number;
    contact_coverage_percent: number;
  };
  source_mix: Array<{ source_type: string; count: number }>;
  candidates: Array<{
    candidate_id: string;
    canonical_name: string;
    current_title: string;
    current_company: string;
    readiness: "sourced" | "needs_verification" | "ready_for_outreach";
    source_count: number;
    source_types: string[];
    evidence_quality: string;
    contactability_score: number;
    merge_keys: string[];
  }>;
};

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
  breakdown: Record<CandidateDisplayStatus, number>;
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
  searchTasks?: SearchTaskView[];
  outreachQueue?: OutreachQueueView;
  inboxQueue?: InboxQueueView;
  candidateGraph?: CandidateGraphView;
}

type SearchTaskView = {
  id: string;
  name: string;
  brief: string;
  frequency: "manual" | "daily" | "weekly";
  status: "active" | "paused";
  last_run_at: string | null;
  next_run_at: string | null;
  run_summary?: {
    last_status: string;
    last_run_at: string | null;
    new_candidates: number;
    updated_candidates: number;
    discovery_items?: Array<{
      candidate_index: number;
      cache_key?: string;
      name: string;
      discovery_state: string;
      evidence_updated: boolean;
    }>;
  };
};

type OutreachQueueView = {
  summary: { due: number; drafted: number; active: number };
  items: Array<{
    id: string;
    candidate_name: string;
    status: string;
    subject: string;
    body?: string;
    contact_profile?: ContactProfileView;
    sequence_messages?: OutreachSequenceMessage[];
    approved_at?: string | null;
    sent_at?: string | null;
    gmail_message_id?: string;
    gmail_thread_id?: string;
    send_error?: string;
    next_follow_up_at: string | null;
    updated_at: string;
    queue_state: "due" | "draft" | "scheduled" | "active";
  }>;
};

type InboxActionStatus = "pending" | "draft_saved" | "scheduled" | "interview_ready" | "stopped" | "reviewed";

type InboxQueueView = {
  summary: {
    total: number;
    interested: number;
    needs_human_reply: number;
    needs_scheduling?: number;
    needs_reply?: number;
    follow_up_later?: number;
    stopped?: number;
    review_required?: number;
  };
  items: Array<{
    id: string;
    candidate_name: string;
    classification: string;
    classification_reason: string;
    last_message_excerpt: string;
    suggested_reply: string;
    next_action?: "schedule" | "reply" | "follow_up_later" | "stop" | "review";
    action_label?: string;
    priority?: "high" | "medium" | "low";
    reply_draft?: string;
    scheduling_prompt?: string;
    action_status?: InboxActionStatus;
    action_state?: {
      action?: string;
      action_status?: InboxActionStatus;
      reply_draft?: string;
      follow_up_at?: string;
      scheduling_message?: string;
    } | null;
    updated_at: string;
    gmail_thread_id?: string;
    outreach_thread_id?: string;
  }>;
  interested_candidates: Array<{
    id: string;
    candidate_name: string;
    classification: string;
    classification_reason: string;
    last_message_excerpt: string;
    suggested_reply: string;
    next_action?: "schedule" | "reply" | "follow_up_later" | "stop" | "review";
    action_label?: string;
    priority?: "high" | "medium" | "low";
    reply_draft?: string;
    scheduling_prompt?: string;
    action_status?: InboxActionStatus;
    action_state?: {
      action?: string;
      action_status?: InboxActionStatus;
      reply_draft?: string;
      follow_up_at?: string;
      scheduling_message?: string;
    } | null;
    outreach_thread_id?: string;
    updated_at: string;
    readiness: "needs_scheduling";
    recommended_next_step: string;
    scheduling_packet?: {
      candidate_summary: string;
      reply_excerpt: string;
      strongest_evidence?: string[];
      risk_flags?: string[];
      unverified_claims?: string[];
      claim_status_summary?: string;
      handoff_title?: string;
      hiring_manager_note?: string;
      verified_summary?: string;
      risk_summary?: string;
      candidate_reply?: string;
      suggested_scheduling_message: string;
      interview_questions: string[];
    };
  }>;
};

type InboxActionItemView = InboxQueueView["items"][number] | InboxQueueView["interested_candidates"][number];

type ContactProfileView = {
  emails?: Array<{
    value: string;
    source: string;
    confidence: "high" | "medium" | "low" | string;
    deliverability_status?: string;
    last_verified_at?: string;
  }>;
  phones?: Array<{ value: string; source: string; confidence: string }>;
  linkedin_url?: string;
  contactability_score?: number;
};

type OutreachSequenceMessage = {
  step: number;
  subject: string;
  body: string;
  evidence_hooks?: string[];
};

type GmailStatusView = {
  configured: boolean;
  connected: boolean;
  gmail_address: string;
  scope: string;
  can_read_inbox?: boolean;
  expires_at: string | null;
};

type ContactProviderStatusView = {
  provider: "hunter" | string;
  enabled: boolean;
  reason: string;
};

type BulkContactResolutionView = {
  status: string;
  provider: string;
  reason: string;
  summary: {
    resolved: number;
    skipped: number;
    failed: number;
    cost_units: number;
  };
  items?: Array<{
    id: string;
    status: string;
    reason: string;
    can_send: boolean;
    cost_units: number;
  }>;
};

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

function monitorCopy(locale: "zh" | "en") {
  return locale === "en" ? {
    title: "Talent Monitor",
    desc: "Keep a recruiting agent running for this project. Each run creates a new research round and marks new or updated candidates.",
    name: "Task name",
    brief: "Hiring brief",
    frequency: "Frequency",
    manual: "Manual",
    daily: "Daily",
    weekly: "Weekly",
    create: "Create monitor",
    run: "Run now",
    pause: "Pause",
    resume: "Resume",
    empty: "No monitors yet.",
    last: "Last run",
    next: "Next run",
    newCandidates: "New",
    updatedCandidates: "Updated",
  } : {
    title: "Talent Monitor",
    desc: "让这个项目拥有持续运行的 AI Sourcer。每轮都会生成新的研究记录，并标记新增或证据更新的候选人。",
    name: "任务名称",
    brief: "招聘需求",
    frequency: "频率",
    manual: "手动",
    daily: "每天",
    weekly: "每周",
    create: "创建监控",
    run: "立即运行",
    pause: "暂停",
    resume: "恢复",
    empty: "还没有持续搜人任务。",
    last: "上次运行",
    next: "下次运行",
    newCandidates: "新增",
    updatedCandidates: "更新",
  };
}

function autonomousCopy(locale: "zh" | "en") {
  return locale === "en" ? {
    title: "Autonomous sourcing",
    desc: "Multi-source candidate graph for this role. External people APIs stay optional until keys are configured.",
    sourced: "Sourced",
    ready: "Ready for outreach",
    needsVerification: "Needs verification",
    contactCoverage: "Contact coverage",
    enabled: "Enabled",
    disabled: "Disabled",
    sourceMix: "Source mix",
    candidateReadiness: "Candidate readiness",
    empty: "No candidates in this role yet.",
    sources: "sources",
    pullOpenJobs: "Pull OpenJobs candidates",
    openJobsEmpty: "OpenJobs Mira returned no candidates for this brief.",
    openJobsSaved: "OpenJobs saved {count} candidates for evidence review. Mira provides profile leads only, so SignalHire will still verify public evidence before recommending or sending.",
    openJobsAuthError: "OpenJobs Mira key is invalid or inactive. Update MIRA_KEY before pulling candidates.",
  } : {
    title: "Autonomous sourcing",
    desc: "这个岗位的多来源候选人图谱。外部 people API 未配置时，仍会使用候选池和公开证据降级展示。",
    sourced: "已发现",
    ready: "可进入外联",
    needsVerification: "需补证据",
    contactCoverage: "联系方式覆盖",
    enabled: "已启用",
    disabled: "未启用",
    sourceMix: "来源构成",
    candidateReadiness: "候选人推进状态",
    empty: "这个岗位还没有候选人。",
    sources: "个来源",
    pullOpenJobs: "拉取 OpenJobs 候选人",
    openJobsEmpty: "OpenJobs Mira 没有为当前岗位返回候选人。",
    openJobsSaved: "OpenJobs 已保存 {count} 位候选人，等待证据核验。Mira 只提供候选人资料线索，SignalHire 仍会先做公开证据交叉验证，再推荐或发送外联。",
    openJobsAuthError: "OpenJobs Mira key 无效或未激活。请更新 MIRA_KEY 后再拉取候选人。",
  };
}

function readinessLabel(readiness: CandidateGraphView["candidates"][number]["readiness"], locale: "zh" | "en") {
  if (locale === "en") return readiness.replace(/_/g, " ");
  if (readiness === "ready_for_outreach") return "可外联";
  if (readiness === "needs_verification") return "需补证据";
  return "已发现";
}

function AutonomousSourcingPanel({
  graph,
  projectId,
  projectBrief,
  locale,
  onChanged,
}: {
  graph?: CandidateGraphView;
  projectId: string;
  projectBrief: string;
  locale: "zh" | "en";
  onChanged: () => void;
}) {
  const c = autonomousCopy(locale);
  const [openJobsBusy, setOpenJobsBusy] = useState(false);
  const [providerMessage, setProviderMessage] = useState("");
  if (!graph) return null;

  async function pullOpenJobsCandidates() {
    setOpenJobsBusy(true);
    setProviderMessage("");
    try {
      const r = await fetch("/api/providers/openjobs/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, brief: projectBrief, limit: 20, locale }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.ok === false) {
        const raw = String(j.error ?? "");
        throw new Error(/invalid api key/i.test(raw) ? c.openJobsAuthError : (j.error || (locale === "en" ? "OpenJobs pull failed." : "OpenJobs 拉取失败。")));
      }
      setProviderMessage(Number(j.saved) > 0 ? c.openJobsSaved.replace("{count}", String(j.saved)) : c.openJobsEmpty);
      if (Number(j.saved) > 0) onChanged();
    } catch (e) {
      setProviderMessage((e as Error).message);
    } finally {
      setOpenJobsBusy(false);
    }
  }

  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiSearch className="h-4 w-4 text-[var(--sh-blue)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--sh-ink)]">{c.title}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{c.desc}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryAction onClick={pullOpenJobsCandidates} disabled={openJobsBusy} className="min-h-9 px-3 py-2 text-xs">
            {c.pullOpenJobs}
          </SecondaryAction>
          {graph.provider_status.map((provider) => (
            <StatusBadge
              key={provider.provider}
              label={`${provider.provider.toUpperCase()} · ${provider.enabled ? c.enabled : c.disabled}`}
              dotClassName={provider.enabled ? "bg-emerald-500" : "bg-gray-400"}
              className={provider.enabled ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-gray-100 text-gray-600 ring-gray-200"}
            />
          ))}
        </div>
      </div>
      {providerMessage && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">{providerMessage}</p>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.sourced}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--sh-ink)]">{graph.summary.candidate_count}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.ready}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{graph.summary.ready_for_outreach_count}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.needsVerification}</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{graph.summary.needs_verification_count}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{c.contactCoverage}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--sh-ink)]">{graph.summary.contact_coverage_percent}%</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{c.sourceMix}</p>
          <div className="mt-3 space-y-2">
            {graph.source_mix.length === 0 ? (
              <p className="text-sm text-[var(--sh-muted)]">{c.empty}</p>
            ) : graph.source_mix.map((source) => (
              <div key={source.source_type} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5">
                <span className="font-medium text-gray-800">{source.source_type.replace(/_/g, " ")}</span>
                <span className="text-gray-500">{source.count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{c.candidateReadiness}</p>
          <div className="mt-3 grid gap-2">
            {graph.candidates.length === 0 ? (
              <p className="text-sm text-[var(--sh-muted)]">{c.empty}</p>
            ) : graph.candidates.slice(0, 6).map((candidate) => (
              <div key={candidate.candidate_id} className="grid gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5 md:grid-cols-[minmax(0,1fr)_120px_100px]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{candidate.canonical_name || "Unnamed candidate"}</p>
                  <p className="truncate text-gray-500">{[candidate.current_title, candidate.current_company].filter(Boolean).join(" · ") || "-"}</p>
                  {candidate.source_types.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {candidate.source_types.slice(0, 3).map((sourceType) => (
                        <span key={sourceType} className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600 ring-1 ring-black/10">
                          {sourceType.replace(/_/g, " ")}
                        </span>
                      ))}
                      {candidate.source_types.length > 3 && (
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-gray-500 ring-1 ring-black/10">
                          +{candidate.source_types.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="self-center rounded-full bg-white px-2 py-1 text-center font-medium text-gray-700 ring-1 ring-black/10">
                  {readinessLabel(candidate.readiness, locale)}
                </span>
                <span className="self-center text-right text-gray-500">{candidate.source_count} {c.sources}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Surface>
  );
}

function TalentMonitorPanel({
  projectId,
  projectBrief,
  tasks,
  locale,
  onChanged,
}: {
  projectId: string;
  projectBrief: string;
  tasks: SearchTaskView[];
  locale: "zh" | "en";
  onChanged: () => void;
}) {
  const c = monitorCopy(locale);
  const [open, setOpen] = useState(tasks.length === 0);
  const [name, setName] = useState("");
  const [brief, setBrief] = useState(projectBrief);
  const [frequency, setFrequency] = useState<"manual" | "daily" | "weekly">("weekly");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function createTask() {
    if (!brief.trim() || creating) return;
    setCreating(true);
    try {
      const r = await fetch("/api/search-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name, brief, frequency, locale }),
      });
      if (!r.ok) throw new Error();
      setName("");
      setBrief(projectBrief);
      setOpen(false);
      onChanged();
    } finally {
      setCreating(false);
    }
  }

  async function runTask(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/search-tasks/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleTask(task: SearchTaskView) {
    setBusyId(task.id);
    try {
      await fetch(`/api/search-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: task.status === "active" ? "paused" : "active", locale }),
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiClock className="h-4 w-4 text-[var(--sh-blue)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--sh-ink)]">{c.title}</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{c.desc}</p>
        </div>
        <SecondaryAction onClick={() => setOpen((value) => !value)} className="min-h-9 px-3 py-2 text-xs">
          {c.create}
        </SecondaryAction>
      </div>

      {open && (
        <div className="grid gap-3 rounded-2xl border border-black/10 bg-white/70 p-4 md:grid-cols-[220px_minmax(0,1fr)_130px_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={c.name}
            className="min-h-10 rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[var(--sh-blue)]"
          />
          <input
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            placeholder={c.brief}
            className="min-h-10 rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[var(--sh-blue)]"
          />
          <select
            value={frequency}
            onChange={(event) => setFrequency(event.target.value as "manual" | "daily" | "weekly")}
            className="min-h-10 rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none focus:border-[var(--sh-blue)]"
            aria-label={c.frequency}
          >
            <option value="manual">{c.manual}</option>
            <option value="daily">{c.daily}</option>
            <option value="weekly">{c.weekly}</option>
          </select>
          <PrimaryAction onClick={createTask} disabled={creating || !brief.trim()} className="min-h-10 whitespace-nowrap px-4 py-2 text-xs">
            {c.create}
          </PrimaryAction>
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[var(--sh-muted)]">{c.empty}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">{task.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--sh-muted)]">{task.brief}</p>
                </div>
                <StatusBadge
                  label={task.status === "active" ? "Active" : "Paused"}
                  dotClassName={task.status === "active" ? "bg-emerald-500" : "bg-amber-500"}
                  className={task.status === "active" ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"}
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <span className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">{c.last}: {task.run_summary?.last_status ?? "-"}</span>
                <span className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">{c.next}: {task.next_run_at ? new Date(task.next_run_at).toLocaleDateString(locale === "en" ? "en-US" : "zh-CN") : "-"}</span>
                <span className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">{c.newCandidates}: {task.run_summary?.new_candidates ?? 0}</span>
                <span className="rounded-xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">{c.updatedCandidates}: {task.run_summary?.updated_candidates ?? 0}</span>
              </div>
              {(task.run_summary?.discovery_items?.length ?? 0) > 0 && (
                <div className="mt-3 space-y-1.5">
                  {task.run_summary?.discovery_items?.slice(0, 4).map((item) => (
                    <div key={item.cache_key ?? `${item.candidate_index}:${item.name}`} className="flex items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5">
                      <span className="min-w-0 truncate font-medium text-gray-800">{item.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                        item.evidence_updated
                          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                          : item.discovery_state === "new_candidate"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                            : "bg-gray-100 text-gray-600 ring-1 ring-gray-200"
                      }`}>
                        {item.evidence_updated ? (locale === "en" ? "Evidence updated" : "证据更新") : item.discovery_state === "new_candidate" ? (locale === "en" ? "New" : "新增") : (locale === "en" ? "Seen" : "已见")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <PrimaryAction onClick={() => runTask(task.id)} disabled={busyId === task.id || task.status !== "active"} className="min-h-9 px-3 py-2 text-xs">
                  <FiPlay className="h-3.5 w-3.5" aria-hidden="true" />
                  {c.run}
                </PrimaryAction>
                <SecondaryAction onClick={() => toggleTask(task)} disabled={busyId === task.id} className="min-h-9 px-3 py-2 text-xs">
                  <FiPauseCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  {task.status === "active" ? c.pause : c.resume}
                </SecondaryAction>
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
}

function primaryEmail(contactProfile?: ContactProfileView) {
  const emails = contactProfile?.emails ?? [];
  return emails.find((email) => Boolean(email.source) && (email.confidence === "high" || email.confidence === "medium") && email.deliverability_status !== "bounced") ?? null;
}

function contactResolutionReasonLabel(reason: string, locale: "zh" | "en") {
  const labels: Record<string, { en: string; zh: string }> = {
    already_sendable: {
      en: "Already has a sendable sourced email.",
      zh: "已有带来源且可发送的邮箱。",
    },
    recent_not_found: {
      en: "Recently checked: no contact found.",
      zh: "近期已查找过，暂未找到联系方式。",
    },
    cost_guard_limit: {
      en: "Skipped by cost guard for this run.",
      zh: "本次被成本护栏跳过。",
    },
    no_contact_found: {
      en: "No contact found from the provider.",
      zh: "联系方式服务未找到邮箱。",
    },
    provider_rate_limited: {
      en: "Provider is rate limited. Try again later.",
      zh: "联系方式服务被限流，请稍后重试。",
    },
    provider_quota_exceeded: {
      en: "Provider quota is exhausted.",
      zh: "联系方式服务额度已用完。",
    },
    provider_auth_error: {
      en: "Provider credentials need admin attention.",
      zh: "联系方式服务凭证需要管理员处理。",
    },
    provider_error: {
      en: "Provider failed. Existing contacts were preserved.",
      zh: "联系方式服务失败，已保留现有联系方式。",
    },
  };
  const match = labels[reason] ?? { en: reason || "Contact status unavailable.", zh: reason || "联系方式状态不可用。" };
  return locale === "en" ? match.en : match.zh;
}

function contactProviderDisabledText(locale: "zh" | "en") {
  return locale === "en"
    ? "Hunter contact provider is not configured. Ask an admin to add Hunter credentials."
    : "Hunter 联系方式服务尚未配置。请管理员添加 Hunter 凭证。";
}

function sendDisabledReason(item: OutreachQueueView["items"][number], gmail?: GmailStatusView | null, locale: "zh" | "en" = "zh") {
  const isEn = locale === "en";
  if (item.status !== "drafted" && item.status !== "approved") return "";
  const emails = item.contact_profile?.emails ?? [];
  if (!primaryEmail(item.contact_profile)) {
    if (emails.length === 0) return isEn ? "Send disabled: no sourced email." : "发送不可用：没有带来源的邮箱。";
    if (emails.every((email) => email.deliverability_status === "bounced")) return isEn ? "Send disabled: email bounced." : "发送不可用：邮箱已退信。";
    if (emails.every((email) => email.confidence === "low")) return isEn ? "Send disabled: email confidence is low." : "发送不可用：邮箱置信度过低。";
    return isEn ? "Send disabled: contact requires review." : "发送不可用：联系方式需要复核。";
  }
  if (!gmail?.connected) return isEn ? "Send disabled: Gmail is not connected." : "发送不可用：Gmail 未连接。";
  if (item.status !== "approved") return isEn ? "Send disabled: approve the first email first." : "发送不可用：请先批准首封邮件。";
  return "";
}

function contactRiskWarning(item: OutreachQueueView["items"][number], locale: "zh" | "en" = "zh") {
  const email = primaryEmail(item.contact_profile);
  if (!email || email.deliverability_status === "valid") return "";
  return locale === "en"
    ? `Review deliverability before sending: ${email.deliverability_status || "unknown"}.`
    : `发送前请复核邮箱可达性：${email.deliverability_status || "unknown"}。`;
}

function handoffText(candidate: InboxQueueView["interested_candidates"][number]) {
  const packet = candidate.scheduling_packet;
  if (!packet) return `${candidate.candidate_name}\n${candidate.last_message_excerpt}`;
  return [
    packet.handoff_title || `Interview-ready handoff for ${candidate.candidate_name}`,
    packet.candidate_summary,
    packet.hiring_manager_note ? `Manager note: ${packet.hiring_manager_note}` : "",
    `Reply: ${packet.reply_excerpt}`,
    `Evidence: ${packet.verified_summary || (packet.strongest_evidence ?? []).join("; ") || "Not verified yet"}`,
    `Risks: ${packet.risk_summary || (packet.risk_flags ?? []).join("; ") || "None recorded"}`,
    `Unverified: ${(packet.unverified_claims ?? []).join("; ") || "None recorded"}`,
    `Candidate reply: ${packet.candidate_reply || packet.suggested_scheduling_message}`,
    `Questions:\n- ${packet.interview_questions.join("\n- ")}`,
  ].filter(Boolean).join("\n");
}

function inboxActionStatusLabel(status: InboxActionStatus | undefined, locale: "zh" | "en") {
  const isEn = locale === "en";
  const labels: Record<InboxActionStatus, string> = {
    pending: isEn ? "Pending" : "待处理",
    draft_saved: isEn ? "Draft saved" : "草稿已保存",
    scheduled: isEn ? "Follow-up scheduled" : "已安排稍后跟进",
    interview_ready: isEn ? "Interview-ready" : "可安排面试",
    stopped: isEn ? "Stopped" : "已停止跟进",
    reviewed: isEn ? "Reviewed" : "已复核",
  };
  return labels[status || "pending"];
}

function inboxActionButtonLabel(item: InboxActionItemView, locale: "zh" | "en") {
  const isEn = locale === "en";
  if (item.action_status && item.action_status !== "pending") return inboxActionStatusLabel(item.action_status, locale);
  if (item.next_action === "schedule") return isEn ? "Mark interview-ready" : "标记可约面";
  if (item.next_action === "reply") return isEn ? "Save suggested draft" : "保存建议草稿";
  if (item.next_action === "follow_up_later") return isEn ? "Schedule follow-up" : "安排稍后跟进";
  if (item.next_action === "stop") return isEn ? "Stop follow-up" : "停止跟进";
  if (item.next_action === "review") return isEn ? "Mark reviewed" : "标记已复核";
  return isEn ? "Apply action" : "执行动作";
}

function defaultFollowUpIso() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

function formatShortDate(value: string | undefined, locale: "zh" | "en") {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", { month: "short", day: "numeric" });
}

function inboxActionPayload(item: InboxActionItemView) {
  const packet = "scheduling_packet" in item ? item.scheduling_packet : undefined;
  return {
    outreach_thread_id: item.outreach_thread_id,
    action: item.next_action,
    reply_draft: item.reply_draft || item.suggested_reply || "",
    follow_up_at: item.next_action === "follow_up_later" ? defaultFollowUpIso() : "",
    scheduling_message: packet?.candidate_reply || item.scheduling_prompt || "",
  };
}

function inboxActionSuccessLabel(item: InboxActionItemView, locale: "zh" | "en") {
  const isEn = locale === "en";
  if (item.next_action === "schedule") return isEn ? "Handoff marked interview-ready." : "交付包已标记为可约面。";
  if (item.next_action === "reply") return isEn ? "Suggested reply draft saved." : "建议回复草稿已保存。";
  if (item.next_action === "follow_up_later") {
    const date = formatShortDate(item.action_state?.follow_up_at, locale);
    return isEn ? `Follow-up scheduled${date ? ` for ${date}` : ""}.` : `已安排稍后跟进${date ? `：${date}` : ""}。`;
  }
  if (item.next_action === "stop") return isEn ? "Follow-up stopped." : "已停止后续跟进。";
  if (item.next_action === "review") return isEn ? "Reply marked reviewed." : "回复已标记复核。";
  return isEn ? "Action saved." : "动作已保存。";
}

function inboxPriorityLine(summary: InboxQueueView["summary"] | undefined, locale: "zh" | "en") {
  const isEn = locale === "en";
  const scheduling = summary?.needs_scheduling ?? summary?.interested ?? 0;
  const reply = summary?.needs_reply ?? 0;
  const review = summary?.review_required ?? summary?.needs_human_reply ?? 0;
  const later = summary?.follow_up_later ?? 0;
  if (scheduling > 0) return isEn ? `Start with ${scheduling} scheduling handoff${scheduling > 1 ? "s" : ""}.` : `优先处理 ${scheduling} 个可约面交付包。`;
  if (reply > 0) return isEn ? `Next, save ${reply} suggested reply draft${reply > 1 ? "s" : ""}.` : `下一步保存 ${reply} 个建议回复草稿。`;
  if (review > 0) return isEn ? `Review ${review} unclear repl${review > 1 ? "ies" : "y"}.` : `需要复核 ${review} 条不明确回复。`;
  if (later > 0) return isEn ? `Schedule ${later} later follow-up${later > 1 ? "s" : ""}.` : `安排 ${later} 个稍后跟进。`;
  return isEn ? "No urgent reply actions right now." : "当前没有紧急回复动作。";
}

function fallbackSequence(item: OutreachQueueView["items"][number]): OutreachSequenceMessage[] {
  const existing = Array.isArray(item.sequence_messages) ? item.sequence_messages : [];
  if (existing.length > 0) return existing;
  return [
    { step: 1, subject: item.subject || "Following up", body: item.body || "", evidence_hooks: [] },
    { step: 2, subject: `Re: ${item.subject || "Following up"}`, body: `Hi ${item.candidate_name}, quick follow-up on my note above.`, evidence_hooks: [] },
    { step: 3, subject: `Re: ${item.subject || "Following up"}`, body: "Last note from me. If now is not the right time, I can close the loop.", evidence_hooks: [] },
  ];
}

function GmailOutreachPanel({ queue, projectId, locale, onChanged }: { queue?: OutreachQueueView; projectId: string; locale: "zh" | "en"; onChanged: () => void }) {
  const isEn = locale === "en";
  const items = queue?.items ?? [];
  const [busyId, setBusyId] = useState<string | null>(null);
  const [gmail, setGmail] = useState<GmailStatusView | null>(null);
  const [contactProvider, setContactProvider] = useState<ContactProviderStatusView | null>(null);
  const [editing, setEditing] = useState<Record<string, { subject: string; body: string }>>({});
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [contactBulkBusy, setContactBulkBusy] = useState(false);
  const [bulkContactResult, setBulkContactResult] = useState<BulkContactResolutionView | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadGmail() {
      try {
        const r = await fetch(`/api/integrations/gmail/status?locale=${locale}`);
        const j = await r.json();
        if (!cancelled && r.ok) setGmail(j as GmailStatusView);
      } catch {
        if (!cancelled) setGmail({ configured: false, connected: false, gmail_address: "", scope: "", expires_at: null });
      }
    }
    void loadGmail();
    return () => { cancelled = true; };
  }, [locale]);

  useEffect(() => {
    let cancelled = false;
    async function loadContactProvider() {
      try {
        const r = await fetch(`/api/contact-resolution/status?locale=${locale}`);
        const j = await r.json();
        if (!cancelled && r.ok) setContactProvider(j as ContactProviderStatusView);
      } catch {
        if (!cancelled) setContactProvider({ provider: "hunter", enabled: false, reason: "provider_status_unavailable" });
      }
    }
    void loadContactProvider();
    return () => { cancelled = true; };
  }, [locale]);

  async function updateOutreachThread(id: string, patch: { status?: string; subject?: string; body?: string; sequence_messages?: OutreachSequenceMessage[]; next_follow_up_at?: string | null }) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/outreach-threads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...patch, locale }),
      });
      if (r.ok) onChanged();
    } finally {
      setBusyId(null);
    }
  }
  async function approveOutreachThread(item: OutreachQueueView["items"][number]) {
    await updateOutreachThread(item.id, { status: "approved", sequence_messages: fallbackSequence(item) });
  }
  async function sendOutreachThread(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/outreach-threads/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const fallback = locale === "en" ? "Gmail send failed." : "Gmail 发送失败。";
        setSendErrors((prev) => ({ ...prev, [id]: String(j.error || fallback) }));
        onChanged();
        return;
      }
      setSendErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }
  async function resolveContact(item: OutreachQueueView["items"][number]) {
    setBusyId(item.id);
    setSendErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    try {
      const r = await fetch("/api/contact-resolution/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outreach_thread_id: item.id, locale }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.status === "disabled" || j.status === "error") {
        const disabled = j.status === "disabled";
        setSendErrors((prev) => ({
          ...prev,
          [item.id]: disabled
            ? (isEn ? "Provider not connected." : "联系方式服务未连接。")
            : String(j.reason || j.error || (isEn ? "Contact resolution failed." : "联系方式解析失败。")),
        }));
      }
      onChanged();
    } finally {
      setBusyId(null);
    }
  }
  async function resolveMissingContacts() {
    setContactBulkBusy(true);
    setBulkContactResult(null);
    try {
      const r = await fetch("/api/contact-resolution/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, locale }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBulkContactResult({
          status: "error",
          provider: contactProvider?.provider || "hunter",
          reason: String(j.error || (isEn ? "Contact resolution failed." : "联系方式解析失败。")),
          summary: { resolved: 0, skipped: 0, failed: 1, cost_units: 0 },
        });
        return;
      }
      setBulkContactResult(j as BulkContactResolutionView);
      onChanged();
    } finally {
      setContactBulkBusy(false);
    }
  }
  async function approveReadyDrafts() {
    const targets = items.filter((item) => item.status === "drafted" && primaryEmail(item.contact_profile));
    setBulkBusy(true);
    try {
      for (const item of targets) {
        await fetch(`/api/outreach-threads/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "approved", sequence_messages: fallbackSequence(item), locale }),
        });
      }
      onChanged();
    } finally {
      setBulkBusy(false);
    }
  }
  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiMail className="h-4 w-4 text-[var(--sh-blue)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--sh-ink)]">{isEn ? "Gmail Outreach Sequence" : "Gmail 外联序列"}</h2>
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--sh-muted)]">
            {isEn ? "Approve sourced drafts, verify contact provenance, and send the first email from Gmail. Follow-ups stay drafted for review." : "审核候选人联系方式来源，批准草稿后从 Gmail 发送首封邮件；跟进邮件先保留为草稿。"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className={`rounded-full px-3 py-1.5 font-semibold ring-1 ${
              gmail?.connected ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-amber-50 text-amber-800 ring-amber-200"
            }`}>
              {gmail?.connected ? `${isEn ? "Gmail connected" : "Gmail 已连接"} · ${gmail.gmail_address}` : (isEn ? "Gmail not connected" : "Gmail 未连接")}
            </span>
            {gmail && !gmail.configured && (
              <span className="rounded-full bg-gray-100 px-3 py-1.5 font-semibold text-gray-600 ring-1 ring-gray-200">
                {isEn ? "Ask an admin to configure Google OAuth" : "请管理员配置 Google OAuth"}
              </span>
            )}
            {contactProvider && !contactProvider.enabled && (
              <span className="rounded-full bg-amber-50 px-3 py-1.5 font-semibold text-amber-800 ring-1 ring-amber-200">
                {contactProviderDisabledText(locale)}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryAction href="/api/integrations/gmail/connect" disabled={gmail?.connected || gmail?.configured === false} className="min-h-9 px-3 py-2 text-xs">
            {isEn ? "Connect Gmail" : "连接 Gmail"}
          </SecondaryAction>
          <SecondaryAction
            onClick={resolveMissingContacts}
            disabled={contactBulkBusy || contactProvider?.enabled === false || items.length === 0}
            className="min-h-9 px-3 py-2 text-xs"
          >
            {isEn ? "Resolve missing contacts" : "批量解析缺失联系方式"}
          </SecondaryAction>
          <PrimaryAction onClick={approveReadyDrafts} disabled={bulkBusy || items.every((item) => item.status !== "drafted" || !primaryEmail(item.contact_profile))} className="min-h-9 px-3 py-2 text-xs">
            {isEn ? "Approve ready drafts" : "批量批准可发送草稿"}
          </PrimaryAction>
        </div>
      </div>
      {bulkContactResult && (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-xs leading-5 text-blue-900 ring-1 ring-blue-100">
          <p className="font-semibold">
            {isEn ? "Contact resolution summary" : "联系方式解析汇总"}
          </p>
          <p className="mt-1">
            {bulkContactResult.status === "disabled"
              ? contactProviderDisabledText(locale)
              : (isEn
                ? `${bulkContactResult.summary.resolved} resolved, ${bulkContactResult.summary.skipped} skipped, ${bulkContactResult.summary.failed} failed. Credits used: ${bulkContactResult.summary.cost_units}.`
                : `已解析 ${bulkContactResult.summary.resolved} 个，跳过 ${bulkContactResult.summary.skipped} 个，失败 ${bulkContactResult.summary.failed} 个。消耗 credits：${bulkContactResult.summary.cost_units}。`)}
          </p>
          <p className="mt-1 text-blue-800">
            {isEn ? "Cost guard: at most 10 provider lookups per bulk run. Already sendable or recently not-found candidates are skipped." : "成本护栏：每次批量最多调用 10 个 provider 查询；已有可发送邮箱或近期未找到的人会跳过。"}
          </p>
          {(bulkContactResult.items?.length ?? 0) > 0 && (
            <div className="mt-3 grid max-h-80 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {bulkContactResult.items?.map((resultItem) => {
                const sourceItem = items.find((queueItem) => queueItem.id === resultItem.id);
                return (
                  <div key={resultItem.id} className="min-w-0 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-blue-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-semibold text-blue-950">
                        {sourceItem?.candidate_name || resultItem.id}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ring-1 ${
                        resultItem.status === "resolved"
                          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                          : resultItem.status === "error"
                            ? "bg-rose-50 text-rose-700 ring-rose-100"
                            : "bg-gray-50 text-gray-700 ring-gray-200"
                      }`}>
                        {resultItem.status}
                      </span>
                    </div>
                    <p className="mt-1 text-blue-800">{contactResolutionReasonLabel(resultItem.reason, locale)}</p>
                    <p className="mt-1 text-blue-700">
                      {isEn
                        ? `${resultItem.can_send ? "Can send" : "Cannot send yet"} · Credits: ${resultItem.cost_units}`
                        : `${resultItem.can_send ? "可发送" : "暂不可发送"} · Credits：${resultItem.cost_units}`}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 p-4 text-sm text-[var(--sh-muted)]">
          {isEn ? "No saved outreach threads yet." : "还没有保存的触达记录。"}
        </p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.slice(0, 6).map((item) => (
            <li key={item.id} className="rounded-2xl border border-black/10 bg-white/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">{item.candidate_name}</p>
                  <p className="mt-1 truncate text-xs text-[var(--sh-muted)]">{item.subject || (isEn ? "Untitled draft" : "未命名草稿")}</p>
                </div>
                <StatusBadge
                  label={item.queue_state === "due" ? (isEn ? "Due" : "到期") : item.status}
                  dotClassName={item.queue_state === "due" ? "bg-amber-500" : "bg-blue-500"}
                  className={item.queue_state === "due" ? "bg-amber-50 text-amber-800 ring-amber-200" : "bg-blue-50 text-blue-700 ring-blue-200"}
                />
              </div>
              <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5">
                {(item.contact_profile?.emails?.length ?? 0) > 0 ? (
                  <div className="space-y-1.5">
                    {item.contact_profile?.emails?.slice(0, 3).map((email) => (
                      <div key={`${email.value}:${email.source}`} className="flex flex-wrap items-center gap-2">
                        <span className={`break-all font-semibold ${primaryEmail(item.contact_profile)?.value === email.value ? "text-gray-800" : "text-amber-700"}`}>{email.value}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-600 ring-1 ring-black/10">
                          source: {email.source}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-600 ring-1 ring-black/10">
                          confidence: {email.confidence}
                        </span>
                        <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-600 ring-1 ring-black/10">
                          deliverability_status: {email.deliverability_status || "unknown"}
                        </span>
                        {email.last_verified_at && (
                          <span className="rounded-full bg-white px-2 py-0.5 font-medium text-gray-600 ring-1 ring-black/10">
                            last_verified_at: {email.last_verified_at}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => navigator.clipboard?.writeText(email.value)}
                          className="rounded-full bg-white px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-100"
                        >
                          {isEn ? "Copy email" : "复制邮箱"}
                        </button>
                        {primaryEmail(item.contact_profile)?.value !== email.value && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700 ring-1 ring-amber-100">
                            {isEn ? "review only" : "仅供审核"}
                          </span>
                        )}
                      </div>
                    ))}
                    <span className="inline-flex rounded-full bg-white px-2 py-0.5 font-medium text-gray-600 ring-1 ring-black/10">
                      contactability_score: {item.contact_profile?.contactability_score ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => resolveContact(item)}
                      disabled={busyId === item.id || contactProvider?.enabled === false}
                      className="inline-flex rounded-full bg-white px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {isEn ? "Review contact" : "复核联系方式"}
                    </button>
                    {item.contact_profile?.linkedin_url && (
                      <a
                        href={item.contact_profile.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex rounded-full bg-white px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-100"
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-amber-700">{isEn ? "No sourced, medium-or-higher confidence email. Sending disabled." : "没有带来源且中高置信度的邮箱，不能发送。"}</p>
                    <button
                      type="button"
                      onClick={() => resolveContact(item)}
                      disabled={busyId === item.id || contactProvider?.enabled === false}
                      className="inline-flex rounded-full bg-white px-2 py-0.5 font-semibold text-gray-700 ring-1 ring-black/10 hover:bg-gray-100 disabled:opacity-50"
                    >
                      {contactProvider?.enabled === false ? contactProviderDisabledText(locale) : (isEn ? "Resolve contact" : "解析联系方式")}
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-2">
                <input
                  value={editing[item.id]?.subject ?? item.subject ?? ""}
                  onChange={(event) => setEditing((prev) => ({ ...prev, [item.id]: { subject: event.target.value, body: prev[item.id]?.body ?? item.body ?? "" } }))}
                  className="min-h-9 rounded-xl border border-black/10 bg-white px-3 text-xs text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]"
                  aria-label={isEn ? "First email subject" : "首封邮件标题"}
                />
                <textarea
                  value={editing[item.id]?.body ?? item.body ?? ""}
                  onChange={(event) => setEditing((prev) => ({ ...prev, [item.id]: { subject: prev[item.id]?.subject ?? item.subject ?? "", body: event.target.value } }))}
                  className="min-h-[88px] resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-xs leading-5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]"
                  aria-label={isEn ? "First email body" : "首封邮件正文"}
                />
              </div>
              <div className="mt-3 rounded-xl border border-black/10 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-[var(--sh-muted)]">{isEn ? "Sequence" : "外联序列"}</p>
                <div className="mt-2 space-y-1.5">
                  {fallbackSequence(item).slice(0, 3).map((message) => (
                    <div key={message.step} className="rounded-lg bg-gray-50 px-2 py-1.5 text-xs ring-1 ring-black/5">
                      <span className="font-semibold text-gray-800">#{message.step}</span>
                      <span className="ml-2 text-gray-600">{message.subject}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="mt-3 text-xs text-[var(--sh-muted)]">
                {item.next_follow_up_at
                  ? `${isEn ? "Follow up" : "跟进"}: ${new Date(item.next_follow_up_at).toLocaleDateString(isEn ? "en-US" : "zh-CN")}`
                  : (isEn ? "No follow-up date" : "未设置跟进日期")}
              </p>
              {sendDisabledReason(item, gmail, locale) && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                  {sendDisabledReason(item, gmail, locale)}
                </p>
              )}
              {contactRiskWarning(item, locale) && (
                <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
                  {contactRiskWarning(item, locale)}
                </p>
              )}
              {(sendErrors[item.id] || item.send_error) && (
                <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">
                  {sendErrors[item.id] || item.send_error}
                </p>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
                <select
                  value={item.status}
                  disabled={busyId === item.id}
                  onChange={(event) => updateOutreachThread(item.id, { status: event.target.value })}
                  className="min-h-9 rounded-xl border border-black/10 bg-white px-2 text-xs text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]"
                  aria-label={isEn ? "Outreach status" : "触达状态"}
                >
                  {[
                    ...(item.status === "sent" ? ["sent"] : []),
                    "drafted",
                    "approved",
                    "follow_up_scheduled",
                    "replied",
                    "bounced",
                    "stopped",
                    "interviewing",
                    "rejected",
                    "hired",
                  ].map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <input
                  type="date"
                  disabled={busyId === item.id}
                  value={item.next_follow_up_at ? item.next_follow_up_at.slice(0, 10) : ""}
                  onChange={(event) => updateOutreachThread(item.id, {
                    next_follow_up_at: event.target.value ? `${event.target.value}T09:00:00.000Z` : null,
                  })}
                  className="min-h-9 rounded-xl border border-black/10 bg-white px-2 text-xs text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]"
                  aria-label={isEn ? "Next follow-up date" : "下次跟进日期"}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <SecondaryAction
                  onClick={() => updateOutreachThread(item.id, {
                    subject: editing[item.id]?.subject ?? item.subject,
                    body: editing[item.id]?.body ?? item.body ?? "",
                    sequence_messages: fallbackSequence({ ...item, subject: editing[item.id]?.subject ?? item.subject, body: editing[item.id]?.body ?? item.body }),
                  })}
                  disabled={busyId === item.id}
                  className="min-h-9 px-3 py-2 text-xs"
                >
                  {isEn ? "Save edits" : "保存修改"}
                </SecondaryAction>
                <PrimaryAction onClick={() => approveOutreachThread(item)} disabled={busyId === item.id || !primaryEmail(item.contact_profile) || item.status !== "drafted"} className="min-h-9 px-3 py-2 text-xs">
                  {isEn ? "Approve" : "批准"}
                </PrimaryAction>
                <PrimaryAction onClick={() => sendOutreachThread(item.id)} disabled={busyId === item.id || !gmail?.connected || !primaryEmail(item.contact_profile) || item.status !== "approved"} className="min-h-9 px-3 py-2 text-xs">
                  <FiSend className="h-3.5 w-3.5" aria-hidden="true" />
                  {isEn ? "Send" : "发送"}
                </PrimaryAction>
                <SecondaryAction onClick={() => updateOutreachThread(item.id, { status: "stopped" })} disabled={busyId === item.id} className="min-h-9 px-3 py-2 text-xs">
                  {isEn ? "Skip" : "跳过"}
                </SecondaryAction>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

function InboxAgentPanel({
  queue,
  projectId,
  projectBrief,
  locale,
  onChanged,
}: {
  queue?: InboxQueueView;
  projectId: string;
  projectBrief: string;
  locale: "zh" | "en";
  onChanged: () => void;
}) {
  const isEn = locale === "en";
  const items = queue?.items ?? [];
  const interested = queue?.interested_candidates ?? [];
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [busyActionId, setBusyActionId] = useState("");
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({});
  const [successMessages, setSuccessMessages] = useState<Record<string, string>>({});

  function inboxSyncErrorLabel(value: unknown) {
    const key = typeof value === "string" ? value : "";
    if (key === "gmail_not_connected_or_readonly_missing") {
      return isEn
        ? "Connect Gmail or re-authorize Gmail read access before syncing replies."
        : "请先连接 Gmail，或重新授权 Gmail 读取权限后再同步回复。";
    }
    return isEn ? "Gmail sync unavailable." : "Gmail 回复同步暂时不可用。";
  }

  async function syncReplies() {
    setSyncing(true);
    setError("");
    try {
      const r = await fetch("/api/inbox/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, role_brief: projectBrief, locale }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(inboxSyncErrorLabel(j.error || j.skipped));
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function applyInboxAction(item: InboxActionItemView) {
    if (!item.outreach_thread_id || !item.next_action) {
      setActionErrors((prev) => ({
        ...prev,
        [item.id]: isEn ? "This reply is not linked to an outreach thread." : "这条回复没有关联外联线程。",
      }));
      return;
    }
    setBusyActionId(item.id);
    setActionErrors((prev) => ({ ...prev, [item.id]: "" }));
    setSuccessMessages((prev) => ({ ...prev, [item.id]: "" }));
    try {
      const r = await fetch("/api/inbox/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inboxActionPayload(item)),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || (isEn ? "Inbox action failed." : "处理回复动作失败。"));
      setSuccessMessages((prev) => ({ ...prev, [item.id]: inboxActionSuccessLabel({ ...item, action_state: j.action_state } as InboxActionItemView, locale) }));
      onChanged();
    } catch (e) {
      setActionErrors((prev) => ({ ...prev, [item.id]: (e as Error).message }));
    } finally {
      setBusyActionId("");
    }
  }

  return (
    <Surface className="space-y-4 p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FiRefreshCw className="h-4 w-4 text-[var(--sh-blue)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--sh-ink)]">Inbox Agent</h2>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">
            {isEn
              ? "Reads only Gmail threads created by SignalHire outreach for this role, then classifies replies into review and interview-ready queues."
              : "只读取这个岗位由 SignalHire 外联创建的 Gmail 线程，并把候选人回复分类到待处理和可约面队列。"}
          </p>
          <p className="mt-2 inline-flex rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-white">
            {inboxPriorityLine(queue?.summary, locale)}
          </p>
        </div>
        <PrimaryAction onClick={syncReplies} disabled={syncing} className="min-h-9 px-3 py-2 text-xs">
          <FiRefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} aria-hidden="true" />
          {isEn ? "Sync Gmail replies" : "同步 Gmail 回复"}
        </PrimaryAction>
      </div>

      {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{isEn ? "Needs scheduling" : "待约面"}</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{queue?.summary.needs_scheduling ?? queue?.summary.interested ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{isEn ? "Needs reply" : "待回复"}</p>
          <p className="mt-1 text-2xl font-semibold text-amber-700">{queue?.summary.needs_reply ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{isEn ? "Follow up later" : "稍后跟进"}</p>
          <p className="mt-1 text-2xl font-semibold text-sky-700">{queue?.summary.follow_up_later ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{isEn ? "Review required" : "需复核"}</p>
          <p className="mt-1 text-2xl font-semibold text-violet-700">{queue?.summary.review_required ?? queue?.summary.needs_human_reply ?? 0}</p>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-xs text-[var(--sh-muted)]">{isEn ? "Stopped" : "已停止"}</p>
          <p className="mt-1 text-2xl font-semibold text-rose-700">{queue?.summary.stopped ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{isEn ? "Inbox Queue" : "回复队列"}</p>
          {items.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-black/10 bg-gray-50 p-3 text-sm text-[var(--sh-muted)]">
              {isEn ? "No synced replies yet." : "还没有同步到候选人回复。"}
            </p>
          ) : (
            <div className="mt-3 min-w-0 space-y-2">
              {items.slice(0, 6).map((item) => (
                <div key={item.id} className="min-w-0 rounded-xl bg-gray-50 px-3 py-2 text-xs ring-1 ring-black/5">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 break-all font-semibold text-gray-900">{item.candidate_name}</p>
                    <span className={`rounded-full px-2 py-0.5 font-semibold ring-1 ${
                      item.classification === "interested"
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                        : item.classification === "not_interested" || item.classification === "bounced"
                          ? "bg-rose-50 text-rose-700 ring-rose-100"
                          : "bg-amber-50 text-amber-800 ring-amber-100"
                    }`}>
                      {item.classification.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 break-words text-gray-600">{item.last_message_excerpt || item.classification_reason}</p>
                  {item.action_label && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <p className="inline-flex rounded-full bg-white px-2 py-1 font-semibold text-gray-700 ring-1 ring-black/5">{item.action_label}</p>
                      <p className="inline-flex rounded-full bg-white px-2 py-1 font-semibold text-gray-500 ring-1 ring-black/5">
                        {inboxActionStatusLabel(item.action_status, locale)}
                      </p>
                    </div>
                  )}
                  {(item.reply_draft || item.suggested_reply) && (
                    <p className="mt-2 break-words rounded-lg bg-white px-2 py-1.5 text-gray-600 ring-1 ring-black/5">{item.reply_draft || item.suggested_reply}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyInboxAction(item)}
                      disabled={busyActionId === item.id || (item.action_status ?? "pending") !== "pending"}
                      className="rounded-full bg-gray-900 px-2.5 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                    >
                      {busyActionId === item.id ? (isEn ? "Saving..." : "保存中...") : inboxActionButtonLabel(item, locale)}
                    </button>
                    {item.next_action === "schedule" && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard?.writeText(item.scheduling_prompt || "")}
                        className="rounded-full bg-white px-2.5 py-1 font-semibold text-gray-700 ring-1 ring-black/10"
                      >
                        {isEn ? "Copy scheduling ask" : "复制约面话术"}
                      </button>
                    )}
                  </div>
                  {actionErrors[item.id] && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-rose-700 ring-1 ring-rose-100">{actionErrors[item.id]}</p>
                  )}
                  {successMessages[item.id] && (
                    <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-800 ring-1 ring-emerald-100">{successMessages[item.id]}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-2xl border border-black/10 bg-white/80 p-4">
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{isEn ? "Interested Candidate Queue" : "可约面候选人队列"}</p>
          {interested.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-black/10 bg-gray-50 p-3 text-sm text-[var(--sh-muted)]">
              {isEn ? "No interview-ready replies yet." : "还没有可约面的候选人回复。"}
            </p>
          ) : (
            <div className="mt-3 min-w-0 space-y-2">
              {interested.slice(0, 5).map((candidate) => (
                <div key={candidate.id} className="min-w-0 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 ring-1 ring-emerald-100">
                  <p className="min-w-0 break-all font-semibold">{candidate.candidate_name}</p>
                  <p className="mt-1 break-words">{candidate.last_message_excerpt}</p>
                  <p className="mt-2 font-medium">{candidate.recommended_next_step}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyInboxAction(candidate)}
                      disabled={busyActionId === candidate.id || (candidate.action_status ?? "pending") !== "pending"}
                      className="rounded-full bg-emerald-700 px-2.5 py-1 font-semibold text-white disabled:cursor-not-allowed disabled:bg-emerald-200"
                    >
                      {busyActionId === candidate.id ? (isEn ? "Saving..." : "保存中...") : inboxActionButtonLabel(candidate, locale)}
                    </button>
                    <span className="rounded-full bg-white/80 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-100">
                      {inboxActionStatusLabel(candidate.action_status, locale)}
                    </span>
                  </div>
                  {actionErrors[candidate.id] && (
                    <p className="mt-2 rounded-lg bg-rose-50 px-2 py-1.5 text-rose-700 ring-1 ring-rose-100">{actionErrors[candidate.id]}</p>
                  )}
                  {successMessages[candidate.id] && (
                    <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-800 ring-1 ring-emerald-100">{successMessages[candidate.id]}</p>
                  )}
                  {candidate.scheduling_packet && (
                    <div className="mt-2 rounded-lg bg-white/80 px-2 py-1.5 text-emerald-950 ring-1 ring-emerald-100">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="break-words font-semibold">{candidate.scheduling_packet.handoff_title || candidate.scheduling_packet.candidate_summary}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(candidate.scheduling_packet?.candidate_reply || candidate.scheduling_packet?.suggested_scheduling_message || "")}
                            className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-100"
                          >
                            {isEn ? "Copy candidate reply" : "复制候选人回复"}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard?.writeText(handoffText(candidate))}
                            className="rounded-full bg-white px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-100"
                          >
                            {isEn ? "Copy manager handoff" : "复制面试官交付包"}
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 break-words">{candidate.scheduling_packet.candidate_reply || candidate.scheduling_packet.suggested_scheduling_message}</p>
                      <p className="mt-1 break-words font-semibold">{candidate.scheduling_packet.claim_status_summary}</p>
                      <p className="mt-1 break-words">
                        {isEn ? "Manager note" : "面试官备注"}: {candidate.scheduling_packet.hiring_manager_note || candidate.scheduling_packet.candidate_summary}
                      </p>
                      <p className="mt-1 break-words">
                        {isEn ? "Evidence" : "证据"}: {candidate.scheduling_packet.verified_summary || (candidate.scheduling_packet.strongest_evidence ?? []).join("; ") || (isEn ? "not verified yet" : "尚未验证")}
                      </p>
                      <p className="mt-1 break-words">
                        {isEn ? "Risks" : "风险"}: {candidate.scheduling_packet.risk_summary || (candidate.scheduling_packet.risk_flags ?? []).join("; ") || (isEn ? "none recorded" : "暂无记录")}
                      </p>
                      <p className="mt-1 break-words">
                        {isEn ? "Unverified" : "未核实"}: {(candidate.scheduling_packet.unverified_claims ?? []).join("; ") || (isEn ? "none recorded" : "暂无记录")}
                      </p>
                      <ul className="mt-1 space-y-1">
                        {candidate.scheduling_packet.interview_questions.slice(0, 3).map((question) => (
                          <li key={question}>- {question}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { locale, t } = useI18n();
  const id = String(params?.id ?? "");

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<ShortlistItem[] | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<CandidateDisplayStatus | "all">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const candidateDetailRef = useRef<HTMLDivElement | null>(null);
  const openCandidateDetail = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
    requestAnimationFrame(() => {
      candidateDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const reloadDetail = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${id}?locale=${locale}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t("projects.detail.error.loadProject"));
      setDetail(j as ProjectDetail);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, [id, locale, t]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const detailRes = await fetch(`/api/projects/${id}?locale=${locale}`);
        const detailJson = await detailRes.json();
        if (cancelled) return;
        if (!detailRes.ok) throw new Error(detailJson.error || t("projects.detail.error.loadProject"));
        const itemsRes = await fetch(`/api/shortlist?project=${encodeURIComponent(id)}&locale=${locale}`);
        const itemsJson = await itemsRes.json();
        if (cancelled) return;
        if (!itemsRes.ok) throw new Error(itemsJson.error || t("projects.detail.error.loadCandidates"));
        setDetail(detailJson as ProjectDetail);
        setItems((itemsJson.items ?? []) as ShortlistItem[]);
        setError("");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id, locale, t]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (statusFilter === "all") return items;
    return items.filter((it) => candidateDisplayStatus(it.status) === statusFilter);
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
    if (!confirm(t("projects.detail.header.deleteConfirm"))) return;
    const r = await fetch(`/api/projects/${id}?locale=${locale}`, { method: "DELETE" });
    if (r.ok) router.push("/app/projects");
    else alert(t("projects.detail.header.deleteFailed"));
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <SecondaryAction href="/app/projects" className="min-h-9 px-3 py-2 text-xs">
          <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          {t("projects.detail.backToProjects")}
        </SecondaryAction>
        {error ? (
          <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p>
        ) : (
          <LoadingState title={t("projects.detail.loading.title")} description={t("projects.detail.loading.desc")} />
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
        {t("projects.detail.backToProjects")}
      </SecondaryAction>

      {/* 头部: name + brief 编辑 + 状态 + 删除 */}
      <ProjectHeader key={`${p.id}:${p.name}:${p.brief ?? ""}`} detail={detail} onChanged={reloadDetail} onDelete={deleteProject} />

      <ProjectControlRoomPanel
        room={controlRoom}
        searchHref={searchHref}
        projectId={id}
        onOpenCandidate={(itemId) => openCandidateDetail(itemId)}
      />

      {actionBrief && (
        <ProjectActionBriefPanel
          brief={actionBrief}
          searchHref={searchHref}
          projectId={id}
          onOpenCandidate={(itemId) => openCandidateDetail(itemId)}
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

      <AutonomousSourcingPanel
        graph={detail.candidateGraph}
        projectId={id}
        projectBrief={briefForSearch}
        locale={locale}
        onChanged={reloadDetail}
      />

      <TalentMonitorPanel
        projectId={id}
        projectBrief={briefForSearch}
        tasks={detail.searchTasks ?? []}
        locale={locale}
        onChanged={reloadDetail}
      />

      <GmailOutreachPanel queue={detail.outreachQueue} projectId={detail.project.id} locale={locale} onChanged={reloadDetail} />

      <InboxAgentPanel
        queue={detail.inboxQueue}
        projectId={id}
        projectBrief={briefForSearch}
        locale={locale}
        onChanged={reloadDetail}
      />

      {showKpiStrip && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <KpiCard label={t("projects.detail.kpi.candidates")} value={p.candidates_total} sub={t("projects.detail.kpi.people")} />
          {SHORT_STATUS.map((s) => (
            <KpiCard
              key={s.value}
              label={t(s.labelKey)}
              value={detail.breakdown[s.value] ?? 0}
              sub={t("projects.detail.kpi.people")}
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
          projectId={id}
          selectedItemId={selectedItemId}
          onOpenCandidate={(itemId) => openCandidateDetail(itemId)}
        />
      )}

      {/* 候选人列表 + 详情面板 */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold text-gray-700">{t("projects.detail.candidates.title")}</h2>
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
          <LoadingState title={t("projects.detail.candidates.loadingTitle")} description={t("projects.detail.candidates.loadingDesc")} />
        )}
        {items && items.length === 0 && (
          <EmptyState title={t("projects.detail.candidates.emptyTitle")} description={t("projects.detail.candidates.emptyDesc")} />
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
                  if (item) openCandidateDetail(item.id);
                }}
              />
            )}
            {projectEvidenceMatrix && (
              <ProjectEvidenceMatrixPanel
                matrix={projectEvidenceMatrix}
                projectId={id}
                selectedItemId={selectedItemId}
                onOpenCandidate={(itemId) => openCandidateDetail(itemId)}
              />
            )}
            {showCandidateComparison && <CandidateComparisonView result={projectComparisonResult} locale={locale} />}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
              <ul className="space-y-2">
                {filteredItems.map((it) => (
                  <CandidateItem key={it.id} item={it} locale={locale} selected={selectedItemId === it.id} onClick={() => openCandidateDetail(it.id)} />
                ))}
                {filteredItems.length === 0 && (
                  <li><EmptyState title={t("projects.detail.candidates.filteredEmptyTitle")} description={t("projects.detail.candidates.filteredEmptyDesc")} /></li>
                )}
              </ul>
              <div ref={candidateDetailRef} className="scroll-mt-6 lg:sticky lg:top-6 lg:self-start">
                {selectedItem ? (
                  <CandidateDetailPanel
                    key={selectedItem.id}
                    item={selectedItem}
                    relatedCandidates={(items ?? []).map((it) => it.candidate)}
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
                    {t("projects.detail.candidates.selectHint")}
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
  breakdown: Record<CandidateDisplayStatus, number>;
  total: number;
  current: CandidateDisplayStatus | "all";
  onClick: (v: CandidateDisplayStatus | "all") => void;
}) {
  const { t } = useI18n();
  if (total === 0) return null;
  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.detail.funnel.eyebrow")}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("projects.detail.funnel.title")}</h2>
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
  onOpenCandidate,
}: {
  brief: ProjectActionBriefView;
  searchHref: string;
  projectId: string;
  onOpenCandidate: (itemId: string) => void;
}) {
  const { t } = useI18n();
  const primary = brief.primaryAction;
  const primaryBackfillHref = primary.backfillInput
    ? `/app/search?project=${projectId}&q=${encodeURIComponent(primary.backfillInput)}`
    : "";
  const canOpenPrimary = Boolean(primary.targetItemId);
  const secondaryActions = brief.actions.filter((action) => action.key !== primary.key).slice(0, 3);

  return (
    <Surface className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.actionBrief.eyebrow")}</p>
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
              {primary.label || t("projects.actionBrief.startSearch")}
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
  projectId: string;
  selectedItemId: string | null;
  onOpenCandidate: (itemId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.decisionQueue.eyebrow")}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("projects.decisionQueue.title")}</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[var(--sh-muted)]">
          {t("projects.decisionQueue.description")}
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
                      {t("projects.decisionQueue.backfill")}
                    </Link>
                  )}
                </div>
              ))}
              {column.items.length > 6 && (
                <p className="px-1 text-xs text-gray-400">
                  {t("projects.decisionQueue.overflow", { count: column.items.length - 6 })}
                </p>
              )}
              {column.items.length === 0 && (
                <p className="rounded-2xl border border-dashed border-black/10 bg-white/50 p-3 text-xs leading-5 text-gray-400">{t("projects.decisionQueue.empty")}</p>
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
  const { t } = useI18n();
  if (matrix.empty) return null;
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
  const { locale, t } = useI18n();
  const [editingName, setEditingName] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [name, setName] = useState(p.name);
  const [brief, setBrief] = useState(p.brief ?? "");

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, locale }),
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.detail.header.eyebrow")}</p>
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
              title={t("projects.detail.header.editTitle")}
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
          <IconButton label={t("projects.detail.header.deleteProject")} onClick={onDelete} Icon={FiTrash2} tone="danger" />
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.detail.brief.label")}</span>
          {!editingBrief && <button onClick={() => setEditingBrief(true)} className="text-xs font-semibold text-[var(--sh-muted)] hover:text-[var(--sh-ink)]">{p.brief ? t("projects.detail.brief.edit") : t("projects.detail.brief.add")}</button>}
        </div>
        {editingBrief ? (
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={saveBrief}
            autoFocus
            rows={4}
            placeholder={t("projects.detail.brief.placeholder")}
            className="block w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20"
          />
        ) : (
          <p className={`whitespace-pre-line text-sm leading-6 ${p.brief ? "text-[var(--sh-muted)]" : "italic text-[var(--sh-faint)]"}`}>
            {p.brief || t("projects.detail.brief.empty")}
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
  const displayStatus = candidateDisplayStatus(item.status);
  const status = SHORT_STATUS.find((s) => s.value === displayStatus) ?? SHORT_STATUS[0];
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
            <p className="truncate text-sm font-semibold text-gray-900">{c.name || t("projects.detail.candidate.unknownName")}</p>
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
        {item.notes && <p className="line-clamp-2 text-xs text-gray-600">{t("projects.detail.candidate.notesPrefix", { notes: item.notes })}</p>}
      </button>
    </li>
  );
}

function CandidateDetailPanel({
  item, relatedCandidates, onChanged, onDeleted, onUnassigned, locale,
}: {
  item: ShortlistItem;
  relatedCandidates: unknown[];
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
      body: JSON.stringify({ ...body, locale }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || t("projects.detail.candidate.updateFailed"));
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
    if (!confirm(t("projects.detail.candidate.removeConfirm"))) return;
    const r = await fetch(`/api/shortlist/${item.id}?locale=${locale}`, { method: "DELETE" });
    if (r.ok) onDeleted();
  }

  async function unassignFromProject() {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: null, locale }),
    });
    if (r.ok) onUnassigned();
  }

  const candidate = item.candidate;
  const isTalent = isTalentShape(candidate);
  const feedbackPanel = buildCandidateFeedbackPanel({ candidate, feedback: candidateFeedback(candidate), locale });

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
        <button onClick={unassignFromProject} className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">{t("projects.detail.candidate.unassign")}</button>
        <IconButton label={t("projects.detail.candidate.delete")} onClick={handleDelete} Icon={FiTrash2} tone="danger" />
      </div>

      <div className="rounded-2xl border border-black/10 bg-white/78 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">{feedbackPanel.title}</h3>
            <p className="mt-1 text-xs leading-5 text-gray-500">{feedbackPanel.description}</p>
          </div>
          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">{t("projects.detail.candidate.feedbackSaved")}</span>
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
        {t("projects.detail.candidate.outreach")}
      </button>
      <OutreachModal
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        candidate={candidate}
        candidateName={asCandidate(candidate).name}
        shortlistItemId={item.id}
        projectId={item.project_id}
        onSaved={() => onChanged({})}
      />

      {/* 备注 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">{t("projects.detail.candidate.notes")}</label>
          <span className="text-[11px] text-gray-400">{savedHint ? t("projects.detail.candidate.saved") : t("projects.detail.candidate.autosave")}</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder={t("projects.detail.candidate.notesPlaceholder")}
          className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:bg-white"
        />
      </div>

      <div className="text-xs text-gray-500">{t("projects.detail.candidate.addedAt", { date: new Date(item.created_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN") })}</div>

      <div className="border-t border-gray-100 pt-4">
        {isTalent ? (
          <CandidateProfileView candidate={candidate as TalentCandidate} relatedCandidates={relatedCandidates} locale={locale} />
        ) : (
          <LegacyCandidateView candidate={candidate} />
        )}
      </div>
    </Surface>
  );
}

function LegacyCandidateView({ candidate }: { candidate: unknown }) {
  const { t } = useI18n();
  const c = asCandidate(candidate);
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-gray-900">{c.name || t("projects.detail.candidate.unknownName")}</h2>
      {c.headline && <p className="text-gray-600">{c.headline}</p>}
    </div>
  );
}
