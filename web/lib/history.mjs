import { buildEvidenceCoverage, buildSearchResultWorkspace } from "./talent-profile.mjs";

export const HISTORY_KINDS = ["all", "search", "verify"];
export const HISTORY_STATUSES = ["all", "queued", "running", "retrying", "done", "error", "canceled"];
export const HISTORY_RANGES = ["all", "today", "7d", "30d"];
export const HISTORY_EVIDENCE_FILTERS = ["all", "high_confidence", "needs_verification", "low_evidence", "has_gaps", "shortlist_ready", "has_outreach_drafts"];

const ACTIVE_STATUSES = new Set(["queued", "running", "retrying"]);
const FINAL_ERROR_STATUSES = new Set(["error", "canceled"]);
const GAP_TYPE_LABELS = {
  research: { en: "Research", zh: "研究" },
  practice: { en: "Practice", zh: "实践" },
  work_history: { en: "Work history", zh: "工作经历" },
  public_voice: { en: "Public voice", zh: "公开表达" },
};
const GAP_TYPE_ALIASES = new Map([
  ["research", "research"],
  ["研究", "research"],
  ["practice", "practice"],
  ["实践", "practice"],
  ["work_history", "work_history"],
  ["work history", "work_history"],
  ["work-history", "work_history"],
  ["工作经历", "work_history"],
  ["public_voice", "public_voice"],
  ["public voice", "public_voice"],
  ["public-voice", "public_voice"],
  ["公开表达", "public_voice"],
]);

function cleanString(value) {
  return String(value ?? "").trim();
}

function oneOf(value, allowed, fallback = "all") {
  const clean = cleanString(value);
  return allowed.includes(clean) ? clean : fallback;
}

function boundedLimit(value, fallback = 30) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

export function normalizeHistoryGapType(value) {
  const clean = cleanString(value).normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
  if (!clean) return "";
  const slug = clean.replace(/[-\s]+/g, "_");
  return GAP_TYPE_ALIASES.get(clean) || GAP_TYPE_ALIASES.get(slug) || slug.replace(/[^\p{L}\p{N}_]+/gu, "").slice(0, 60);
}

function derivedEvidenceFilter(evidence, gap) {
  return gap ? `${evidence}|gap:${gap}` : evidence;
}

export function normalizeHistoryFilters(searchParams) {
  const get = (key) => typeof searchParams?.get === "function" ? searchParams.get(key) : searchParams?.[key];
  const rawStatus = get("status");
  const status = oneOf(rawStatus, HISTORY_STATUSES);
  const evidence = oneOf(get("evidence"), HISTORY_EVIDENCE_FILTERS);
  const gap = normalizeHistoryGapType(get("gap"));
  const needsActionValue = get("needsAction");
  return {
    q: cleanString(get("q")).slice(0, 120),
    kind: oneOf(get("kind"), HISTORY_KINDS),
    status,
    projectId: cleanString(get("projectId")).slice(0, 80),
    range: oneOf(get("range"), HISTORY_RANGES),
    evidence: derivedEvidenceFilter(evidence, gap),
    evidenceFilter: evidence,
    gap,
    needsAction: needsActionValue === true || needsActionValue === "1" || rawStatus === "needs_action",
    limit: boundedLimit(get("limit"), 30),
    cursor: cleanString(get("cursor")).slice(0, 80),
  };
}

export function historyRangeStart(range, now = new Date()) {
  const start = new Date(now);
  if (range === "today") {
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (range === "7d") {
    start.setDate(start.getDate() - 7);
    return start.toISOString();
  }
  if (range === "30d") {
    start.setDate(start.getDate() - 30);
    return start.toISOString();
  }
  return null;
}

function statusLabel(status, locale) {
  const en = locale === "en";
  const labels = {
    queued: en ? "Queued" : "排队中",
    running: en ? "Running" : "运行中",
    retrying: en ? "Retrying" : "重试中",
    done: en ? "Done" : "已完成",
    error: en ? "Failed" : "失败",
    canceled: en ? "Canceled" : "已取消",
  };
  return labels[status] ?? status;
}

function kindLabel(kind, locale) {
  const en = locale === "en";
  const labels = {
    search: en ? "Search" : "搜人",
    verify: en ? "Verify" : "核验",
  };
  return labels[kind] ?? kind;
}

function rangeLabel(range, locale) {
  const en = locale === "en";
  const labels = {
    today: en ? "Today" : "今天",
    "7d": en ? "7 days" : "7 天",
    "30d": en ? "30 days" : "30 天",
  };
  return labels[range] ?? range;
}

function evidenceLabel(evidence, locale) {
  const en = locale === "en";
  const labels = {
    high_confidence: en ? "High confidence" : "高置信",
    needs_verification: en ? "Needs verification" : "待核验",
    low_evidence: en ? "Low evidence" : "低证据",
    has_gaps: en ? "Has evidence gaps" : "有证据缺口",
    shortlist_ready: en ? "Shortlist ready" : "可交付名单",
    has_outreach_drafts: en ? "Has outreach drafts" : "有外联草稿",
  };
  return labels[evidence] ?? evidence;
}

function gapLabel(gap, locale) {
  const normalized = normalizeHistoryGapType(gap);
  const labels = GAP_TYPE_LABELS[normalized];
  if (labels) return locale === "en" ? labels.en : labels.zh;
  return cleanString(gap).replace(/_/g, " ");
}

function chipLabel(name, value, locale) {
  const en = locale === "en";
  const names = {
    q: en ? "Keyword" : "关键词",
    kind: en ? "Type" : "类型",
    status: en ? "Status" : "状态",
    range: en ? "Time" : "时间",
    projectId: en ? "Role" : "岗位",
    evidence: en ? "Evidence" : "证据",
    gap: en ? "Gap type" : "缺口类型",
  };
  return `${names[name] ?? name}: ${value}`;
}

/**
 * @returns {Array<{ key: string; label: string; clearPatch: Record<string, string> }>}
 */
export function buildHistoryFilterChips(filters, projects = [], { locale = "zh" } = {}) {
  const projectMap = new Map((projects ?? []).map((project) => [cleanString(project?.id), cleanString(project?.name)]));
  const chips = [];
  const q = cleanString(filters?.q);
  const kind = oneOf(filters?.kind, HISTORY_KINDS);
  const rawStatus = cleanString(filters?.status);
  const status = oneOf(rawStatus, HISTORY_STATUSES);
  const needsAction = filters?.needsAction === true || rawStatus === "needs_action";
  const range = oneOf(filters?.range, HISTORY_RANGES);
  const projectId = cleanString(filters?.projectId).slice(0, 80);
  const evidence = oneOf(filters?.evidenceFilter ?? filters?.evidence, HISTORY_EVIDENCE_FILTERS);
  const gap = normalizeHistoryGapType(filters?.gap);

  if (q) {
    chips.push({ key: "q", label: chipLabel("q", q, locale), clearPatch: { q: "" } });
  }
  if (kind !== "all") {
    chips.push({ key: "kind", label: chipLabel("kind", kindLabel(kind, locale), locale), clearPatch: { kind: "all" } });
  }
  if (needsAction) {
    chips.push({ key: "status", label: chipLabel("status", locale === "en" ? "Needs action" : "需要处理", locale), clearPatch: { status: "all", needsAction: "" } });
  } else if (status !== "all") {
    chips.push({ key: "status", label: chipLabel("status", statusLabel(status, locale), locale), clearPatch: { status: "all" } });
  }
  if (range !== "all") {
    chips.push({ key: "range", label: chipLabel("range", rangeLabel(range, locale), locale), clearPatch: { range: "all" } });
  }
  if (projectId) {
    chips.push({ key: "projectId", label: chipLabel("projectId", projectMap.get(projectId) || projectId, locale), clearPatch: { projectId: "" } });
  }
  if (evidence !== "all") {
    chips.push({ key: "evidence", label: chipLabel("evidence", evidenceLabel(evidence, locale), locale), clearPatch: { evidence: "all" } });
  }
  if (gap) {
    chips.push({ key: "gap", label: chipLabel("gap", gapLabel(gap, locale), locale), clearPatch: { gap: "" } });
  }
  return chips;
}

function nextActionForRun(row, locale) {
  const en = locale === "en";
  const kind = row.kind === "verify" ? "verify" : "search";
  const query = encodeURIComponent(row.query_text || "");
  if (row.project_id && row.status === "done") {
    return { label: en ? "Continue role" : "继续岗位", href: `/app/projects/${row.project_id}`, kind: "open" };
  }
  if (row.status === "error") {
    return { label: en ? "Retry research" : "重试研究", href: kind === "verify" ? `/app/verify?bio=${query}` : `/app/search?q=${query}`, kind: "retry" };
  }
  if (row.status === "canceled") {
    return { label: en ? "Adjust input" : "调整输入", href: kind === "verify" ? `/app/verify?bio=${query}` : `/app/search?q=${query}`, kind: "adjust" };
  }
  if (ACTIVE_STATUSES.has(row.status)) {
    return { label: en ? "View progress" : "查看进度", href: kind === "verify" ? `/app/verify?bio=${query}` : `/app/search?q=${query}`, kind: "progress" };
  }
  if (kind === "verify") {
    return { label: en ? "View report" : "查看报告", href: `/app/verify?bio=${query}`, kind: "open" };
  }
  return { label: en ? "Open search" : "打开搜索", href: `/app/search?q=${query}`, kind: "open" };
}

export function buildHistoryEvidenceSummary(result, { locale = "zh" } = {}) {
  if (!result || typeof result !== "object") return null;
  try {
    const workspace = buildSearchResultWorkspace(result, { locale });
    const candidateCount = Number(workspace?.completion?.candidate_count ?? 0);
    if (!candidateCount) return null;
    const highConfidence = workspace.groups?.find((group) => group.key === "high_confidence")?.count ?? 0;
    const needsVerification = workspace.groups?.find((group) => group.key === "needs_verification")?.count ?? 0;
    const lowEvidenceByBucket = (workspace.groups?.find((group) => group.key === "lower_confidence")?.count ?? 0)
      + (workspace.groups?.find((group) => group.key === "adjacent_pool")?.count ?? 0);
    const lowEvidenceByAudit = Array.isArray(workspace.candidates)
      ? workspace.candidates.filter((candidate) => candidate?.evidence_quality === "low").length
      : 0;
    const lowEvidence = Math.max(lowEvidenceByBucket, lowEvidenceByAudit);
    const missingCoverage = (buildEvidenceCoverage(result) ?? []).filter((group) => group.status === "missing");
    const primaryGaps = missingCoverage
      .map((group) => group.label)
      .filter(Boolean)
      .slice(0, 3);
    const gapTypes = missingCoverage
      .map((group) => normalizeHistoryGapType(group.key || group.label))
      .filter(Boolean);
    const outreachDraftCount = countOutreachDrafts(result);
    return {
      candidate_count: candidateCount,
      high_confidence_count: highConfidence,
      needs_verification_count: needsVerification,
      low_evidence_count: lowEvidence,
      primary_gaps: primaryGaps,
      gap_types: Array.from(new Set(gapTypes)),
      has_gaps: primaryGaps.length > 0,
      shortlist_ready: highConfidence > 0,
      outreach_draft_count: outreachDraftCount,
      has_outreach_drafts: outreachDraftCount > 0,
    };
  } catch {
    return null;
  }
}

function countOutreachDrafts(result) {
  const source = result && typeof result === "object" ? result : {};
  const explicitCount = Number(source.outreach_draft_count ?? source.outreach_drafts_count ?? 0);
  const explicit = Number.isFinite(explicitCount) ? explicitCount : 0;
  const candidates = Array.isArray(source.candidates) ? source.candidates : [];
  const candidateCount = candidates.filter(candidateHasOutreachDraft).length;
  const draftRows = [
    ...(Array.isArray(source.outreach_drafts) ? source.outreach_drafts : []),
    ...(Array.isArray(source.drafts) ? source.drafts : []),
    ...(Array.isArray(source.outreach_queue?.items) ? source.outreach_queue.items.filter(candidateHasOutreachDraft) : []),
  ].length;
  return Math.max(0, explicit, candidateCount, draftRows);
}

function candidateHasOutreachDraft(candidate) {
  if (!candidate || typeof candidate !== "object") return false;
  const status = cleanString(candidate.status || candidate.outreach_status).toLowerCase();
  if (status === "drafted" || status === "outreach_drafted") return true;
  const draftFields = [
    candidate.outreach_draft,
    candidate.email_draft,
    candidate.reply_draft,
    candidate.suggested_reply,
    candidate.saved_scheduling_draft,
    candidate.gmail_draft_id,
    candidate.outreach_thread?.gmail_draft_id,
  ];
  if (draftFields.some((value) => cleanString(value))) return true;
  const sequence = Array.isArray(candidate.outreach_sequence) ? candidate.outreach_sequence : [];
  return sequence.some((message) => cleanString(message?.send_mode) === "draft_for_review" && (cleanString(message?.subject) || cleanString(message?.body)));
}

function buildNeedsActionReasons(status, evidenceSummary, locale) {
  const en = locale === "en";
  const reasons = [];
  if (status === "error") reasons.push(en ? "Failed run" : "运行失败");
  if (status === "canceled") reasons.push(en ? "Canceled run" : "运行已取消");
  if (evidenceSummary?.has_gaps) reasons.push(en ? "Evidence gaps" : "证据缺口");
  if (evidenceSummary?.needs_verification_count) {
    reasons.push(en ? "Candidates need verification" : "候选人待核验");
  }
  if (evidenceSummary?.low_evidence_count) {
    reasons.push(en ? "Low-evidence candidates" : "低证据候选人");
  }
  return reasons;
}

export function buildHistoryRunView(row, { locale = "zh" } = {}) {
  const normalized = {
    id: cleanString(row.id),
    kind: row.kind === "verify" ? "verify" : "search",
    status: HISTORY_STATUSES.includes(row.status) && row.status !== "all" ? row.status : "done",
    label: cleanString(row.label) || cleanString(row.query_text) || (locale === "en" ? "Untitled research" : "未命名研究"),
    summary: cleanString(row.summary),
    query_text: cleanString(row.query_text),
    project_id: cleanString(row.project_id) || null,
    project_name: cleanString(row.project_name) || null,
    search_task_id: cleanString(row.search_task_id) || null,
    created_at: cleanString(row.created_at),
    updated_at: cleanString(row.updated_at),
    finished_at: cleanString(row.finished_at) || null,
  };
  const evidenceSummary = buildHistoryEvidenceSummary(row.result, { locale });
  const needsActionReasons = buildNeedsActionReasons(normalized.status, evidenceSummary, locale);
  return {
    ...normalized,
    status_label: statusLabel(normalized.status, locale),
    next_action: nextActionForRun(normalized, locale),
    evidence_summary: evidenceSummary ?? undefined,
    needs_action: needsActionReasons.length > 0,
    needs_action_reasons: needsActionReasons.length > 0 ? needsActionReasons : undefined,
  };
}

export function matchesHistoryEvidenceFilter(run, filter) {
  const parsed = parseHistoryEvidenceFilter(filter);
  if (!matchesHistoryGapFilter(run, parsed.gap)) return false;
  filter = parsed.evidence;
  if (!filter || filter === "all") return true;
  const evidence = run.evidence_summary;
  if (filter === "high_confidence") return Boolean(evidence?.high_confidence_count);
  if (filter === "needs_verification") return Boolean(evidence?.needs_verification_count);
  if (filter === "low_evidence") return Boolean(evidence?.low_evidence_count);
  if (filter === "has_gaps") return Boolean(evidence?.has_gaps);
  if (filter === "shortlist_ready") return Boolean(evidence?.shortlist_ready);
  if (filter === "has_outreach_drafts") return Boolean(evidence?.has_outreach_drafts);
  return true;
}

function parseHistoryEvidenceFilter(filter) {
  const raw = cleanString(filter);
  if (!raw) return { evidence: "all", gap: "" };
  const parts = raw.split("|");
  const evidence = oneOf(parts[0], HISTORY_EVIDENCE_FILTERS);
  const gap = parts
    .map((part) => part.startsWith("gap:") ? normalizeHistoryGapType(part.slice(4)) : "")
    .find(Boolean) || "";
  return { evidence, gap };
}

function matchesHistoryGapFilter(run, gap) {
  const normalized = normalizeHistoryGapType(gap);
  if (!normalized) return true;
  const summary = run?.evidence_summary;
  const candidates = [
    ...(Array.isArray(summary?.gap_types) ? summary.gap_types : []),
    ...(Array.isArray(summary?.primary_gaps) ? summary.primary_gaps : []),
  ].map(normalizeHistoryGapType);
  return candidates.includes(normalized);
}
