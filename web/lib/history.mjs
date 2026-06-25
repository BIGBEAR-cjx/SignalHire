import { buildEvidenceCoverage, buildSearchResultWorkspace } from "./talent-profile.mjs";

export const HISTORY_KINDS = ["all", "search", "verify"];
export const HISTORY_STATUSES = ["all", "queued", "running", "retrying", "done", "error", "canceled"];
export const HISTORY_RANGES = ["all", "today", "7d", "30d"];
export const HISTORY_EVIDENCE_FILTERS = ["all", "high_confidence", "needs_verification", "low_evidence", "has_gaps", "shortlist_ready"];

const ACTIVE_STATUSES = new Set(["queued", "running", "retrying"]);
const FINAL_ERROR_STATUSES = new Set(["error", "canceled"]);

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

export function normalizeHistoryFilters(searchParams) {
  const get = (key) => typeof searchParams?.get === "function" ? searchParams.get(key) : searchParams?.[key];
  const rawStatus = get("status");
  const status = oneOf(rawStatus, HISTORY_STATUSES);
  const evidence = oneOf(get("evidence"), HISTORY_EVIDENCE_FILTERS);
  const needsActionValue = get("needsAction");
  return {
    q: cleanString(get("q")).slice(0, 120),
    kind: oneOf(get("kind"), HISTORY_KINDS),
    status,
    projectId: cleanString(get("projectId")).slice(0, 80),
    range: oneOf(get("range"), HISTORY_RANGES),
    evidence,
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
    const lowEvidence = (workspace.groups?.find((group) => group.key === "lower_confidence")?.count ?? 0)
      + (workspace.groups?.find((group) => group.key === "adjacent_pool")?.count ?? 0);
    const primaryGaps = (buildEvidenceCoverage(result) ?? [])
      .filter((group) => group.status === "missing")
      .map((group) => group.label)
      .filter(Boolean)
      .slice(0, 3);
    return {
      candidate_count: candidateCount,
      high_confidence_count: highConfidence,
      needs_verification_count: needsVerification,
      low_evidence_count: lowEvidence,
      primary_gaps: primaryGaps,
      has_gaps: primaryGaps.length > 0,
      shortlist_ready: highConfidence > 0,
    };
  } catch {
    return null;
  }
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
  return {
    ...normalized,
    status_label: statusLabel(normalized.status, locale),
    next_action: nextActionForRun(normalized, locale),
    evidence_summary: evidenceSummary ?? undefined,
    needs_action: FINAL_ERROR_STATUSES.has(normalized.status) || Boolean(evidenceSummary?.has_gaps || evidenceSummary?.needs_verification_count),
  };
}

export function matchesHistoryEvidenceFilter(run, filter) {
  if (!filter || filter === "all") return true;
  const evidence = run.evidence_summary;
  if (filter === "high_confidence") return Boolean(evidence?.high_confidence_count);
  if (filter === "needs_verification") return Boolean(evidence?.needs_verification_count);
  if (filter === "low_evidence") return Boolean(evidence?.low_evidence_count);
  if (filter === "has_gaps") return Boolean(evidence?.has_gaps);
  if (filter === "shortlist_ready") return Boolean(evidence?.shortlist_ready);
  return true;
}
