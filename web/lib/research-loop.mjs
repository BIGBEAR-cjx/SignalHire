import { t as translate } from "./i18n.mjs";

const SOURCE_ORDER = ["github", "papers", "company", "public_web"];
const PHASE_KEYS = ["planning", "queued", "retrying", "running", "searching", "fetching", "synthesizing", "shortlisting", "done", "error", "canceled"];

function msg(locale, key, params) {
  return translate(locale, key, params);
}

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "zh";
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanFeed(feed) {
  return Array.isArray(feed) ? feed.filter(Boolean) : [];
}

function isUrlLike(value) {
  return /^https?:\/\//i.test(value) || /\bsite:/i.test(value);
}

function sourceTypeForText(value) {
  const text = cleanString(value);
  const lower = text.toLowerCase();
  if (!lower) return "public_web";
  if (lower.includes("github.com") || lower.includes("site:github")) return "github";
  if (
    lower.includes("arxiv.org") ||
    lower.includes("doi.org") ||
    lower.includes("scholar.google") ||
    lower.includes("semanticscholar.org") ||
    lower.includes("researchgate.net") ||
    lower.includes(" paper ") ||
    lower.includes("论文")
  ) {
    return "papers";
  }
  if (
    isUrlLike(lower) &&
    /\/(about|careers|company|jobs|people|research|team)\b/.test(lower) &&
    !lower.includes("blog")
  ) {
    return "company";
  }
  return "public_web";
}

function eventDetail(item, locale = "zh") {
  const detail = cleanString(item?.info);
  if (detail) return detail;
  return item?.kind === "fetch" ? msg(locale, "research.loop.phase.fetching.detail") : msg(locale, "research.loop.phase.searching.detail");
}

function buildAction(locale, key) {
  return {
    key,
    label: msg(locale, `feedback.preview.${key}.label`),
    detail: msg(locale, `feedback.preview.${key}.detail`),
  };
}

function pushUniqueAction(actions, locale, key) {
  if (!actions.some((item) => item.key === key)) {
    actions.push(buildAction(locale, key));
  }
}

const CANDIDATE_FEEDBACK_GROUPS = [
  {
    key: "precision",
    labelKey: "feedback.precision",
    options: ["accurate", "partial", "off"],
  },
  {
    key: "satisfaction",
    labelKey: "feedback.satisfaction",
    options: ["satisfied", "mixed", "unsatisfied"],
  },
  {
    key: "issue",
    labelKey: "feedback.issue",
    options: ["weak_evidence", "wrong_direction", "wrong_seniority", "wrong_location"],
  },
  {
    key: "focus",
    labelKey: "feedback.focus",
    options: ["stronger_evidence", "stricter_match", "expand_sources", "adjacent_pools"],
  },
];

/**
 * @param {{ candidate?: unknown; feedback?: Record<string, string | undefined>; locale?: string }} input
 */
export function buildCandidateFeedbackPanel({ candidate = {}, feedback = {}, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const candidateName = cleanString(candidate?.name) || msg(normalizedLocale, "candidateFeedback.thisCandidate");
  return {
    locale: normalizedLocale,
    candidateName,
    title: msg(normalizedLocale, "candidateFeedback.title"),
    description: msg(normalizedLocale, "candidateFeedback.description", { name: candidateName }),
    groups: CANDIDATE_FEEDBACK_GROUPS.map((group) => ({
      key: group.key,
      label: msg(normalizedLocale, group.labelKey),
      options: group.options.map((value) => ({
        value,
        label: msg(normalizedLocale, `candidateFeedback.${group.key}.${value}`) || msg(normalizedLocale, `feedback.${group.key}.${value}`),
        selected: cleanString(feedback?.[group.key]) === value,
      })),
    })),
  };
}

const DECISION_QUEUE_COLUMNS = [
  { key: "review", zh: "待看", en: "To review" },
  { key: "interested", zh: "推进中", en: "In progress" },
  { key: "needs_evidence", zh: "需补证据", en: "Needs evidence" },
  { key: "rejected", zh: "不合适", en: "Not a fit" },
];

function candidateName(candidate) {
  return cleanString(candidate?.name) || "Unknown candidate";
}

function candidateSubtitle(candidate) {
  return [candidate?.current_role, candidate?.current_company].map(cleanString).filter(Boolean).join(" · ")
    || cleanString(candidate?.headline);
}

function candidateEvidenceRisk(candidate) {
  const quality = cleanString(candidate?.evidence_audit?.overall_evidence_quality).toLowerCase();
  if (quality === "low") return true;
  const claims = Array.isArray(candidate?.claims) ? candidate.claims : [];
  return claims.some((claim) => {
    const verdict = cleanString(claim?.verdict).toLowerCase();
    return verdict === "unverified" || verdict === "contradicted";
  });
}

function decisionQueueReason(locale, key, item) {
  const name = candidateName(item?.candidate);
  const copy = {
    zh: {
      review: `${name} 还未处理，建议先查看证据档案并决定是否推进。`,
      interested: `${name} 已进入沟通或面试流程，继续推进下一步动作。`,
      needs_evidence: `${name} 存在证据缺口，建议补搜后再做判断。`,
      rejected: `${name} 已标记为不合适，保留记录避免重复评估。`,
    },
    en: {
      review: `${name} has not been reviewed yet. Check the evidence dossier before deciding.`,
      interested: `${name} is already in outreach or interview flow. Continue the next action.`,
      needs_evidence: `${name} has evidence gaps. Backfill evidence before deciding.`,
      rejected: `${name} is marked as not a fit, so keep it out of the active review queue.`,
    },
  }[locale === "en" ? "en" : "zh"];
  return copy[key] ?? "";
}

function decisionQueueKey(item) {
  const status = cleanString(item?.status);
  if (status === "rejected") return "rejected";
  if (candidateEvidenceRisk(item?.candidate) && status !== "hired") return "needs_evidence";
  if (status === "contacted" || status === "interviewing" || status === "hired") return "interested";
  return "review";
}

/**
 * @param {{ items?: unknown[]; locale?: string }} input
 */
export function buildProjectCandidateDecisionQueue({ items = [], locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const columns = DECISION_QUEUE_COLUMNS.map((column) => ({
    key: column.key,
    title: normalizedLocale === "en" ? column.en : column.zh,
    count: 0,
    items: [],
  }));
  const byKey = new Map(columns.map((column) => [column.key, column]));

  for (const item of Array.isArray(items) ? items : []) {
    if (!isPlainObject(item)) continue;
    const key = decisionQueueKey(item);
    const column = byKey.get(key) ?? byKey.get("review");
    if (!column) continue;
    column.items.push({
      id: cleanString(item.id),
      status: cleanString(item.status) || "new",
      name: candidateName(item.candidate),
      subtitle: candidateSubtitle(item.candidate),
      matchScore: Number.isFinite(Number(item.candidate?.match_score)) ? Math.round(Number(item.candidate.match_score)) : null,
      reason: decisionQueueReason(normalizedLocale, key, item),
    });
  }

  for (const column of columns) column.count = column.items.length;
  return { locale: normalizedLocale, columns };
}

function projectAction(locale, key, params) {
  return {
    key,
    label: msg(locale, `projects.next.${key}.label`, params),
    detail: msg(locale, `projects.next.${key}.detail`, params),
  };
}

function timestampMs(value) {
  const time = Date.parse(cleanString(value));
  return Number.isFinite(time) ? time : 0;
}

function runVariant(run, roundNumber) {
  const label = cleanString(run?.label);
  const queryText = cleanString(run?.query_text);
  const text = `${label}\n${queryText}`.toLowerCase();
  if (run?.kind === "verify") return "verify";
  if (text.includes("feedback-optimized signalhire search") || text.includes("user feedback from reviewed shortlist")) return "feedback";
  if (label.startsWith("补搜") || text.includes("backfill signalhire search")) return "backfill";
  return roundNumber <= 1 ? "initial" : "followup";
}

function runDescription(locale, variant, params) {
  return msg(locale, `projects.rounds.${variant}.description`, params);
}

/**
 * @param {unknown} value
 */
function feedbackFromRunResult(value) {
  if (!isPlainObject(value) || !isPlainObject(value.search_feedback)) return null;
  return value.search_feedback;
}

function feedbackValueLabel(locale, key, value) {
  const normalized = cleanString(value);
  if (!normalized) return "";
  return msg(locale, `feedback.${key}.${normalized}`);
}

function buildRoundFeedbackSummary(run, locale) {
  const feedback = feedbackFromRunResult(run?.result);
  if (!feedback) return null;
  const items = [
    ["precision", msg(locale, "projects.rounds.feedback.precision"), feedbackValueLabel(locale, "precision", feedback.precision)],
    ["satisfaction", msg(locale, "projects.rounds.feedback.satisfaction"), feedbackValueLabel(locale, "satisfaction", feedback.satisfaction)],
    ["issue", msg(locale, "projects.rounds.feedback.issue"), feedbackValueLabel(locale, "issue", feedback.issue)],
    ["focus", msg(locale, "projects.rounds.feedback.focus"), feedbackValueLabel(locale, "focus", feedback.focus)],
  ].flatMap(([key, label, value]) => cleanString(value) ? [{ key, label, value }] : []);
  if (!items.length) return null;
  return {
    title: msg(locale, "projects.rounds.feedbackTitle"),
    items,
  };
}

/**
 * @param {{ runs?: Array<{ updated_at?: string; result?: unknown }>; baseInput?: string; locale?: string }} input
 */
export function buildLatestProjectFeedbackPreference({ runs = [], baseInput = "", locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedRuns = Array.isArray(runs) ? runs.filter(Boolean) : [];
  const latestRun = normalizedRuns
    .map((run, index) => ({ run, index, feedback: feedbackFromRunResult(run?.result) }))
    .filter(({ feedback }) => cleanString(feedback?.optimized_query))
    .sort((a, b) => timestampMs(b.run?.updated_at) - timestampMs(a.run?.updated_at) || b.index - a.index)[0];

  if (!latestRun) {
    return {
      locale: normalizedLocale,
      canApply: false,
      title: msg(normalizedLocale, "search.feedbackPreference.title"),
      detail: "",
      optimizedInput: cleanString(baseInput),
      items: [],
    };
  }

  const summary = buildRoundFeedbackSummary({ result: { search_feedback: latestRun.feedback } }, normalizedLocale);
  return {
    locale: normalizedLocale,
    canApply: true,
    title: msg(normalizedLocale, "search.feedbackPreference.title"),
    detail: msg(normalizedLocale, "search.feedbackPreference.detail"),
    optimizedInput: cleanString(latestRun.feedback?.optimized_query),
    items: summary?.items ?? [],
  };
}

/**
 * @param {{ runs?: Array<{ id?: string; kind?: string; label?: string; summary?: string | null; status?: string; query_text?: string; updated_at?: string; result?: unknown }>; locale?: string }} input
 */
export function buildProjectResearchRounds({ runs = [], locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedRuns = Array.isArray(runs) ? runs.filter(Boolean) : [];
  const chronological = normalizedRuns
    .map((run, index) => ({ run, index }))
    .sort((a, b) => timestampMs(a.run?.updated_at) - timestampMs(b.run?.updated_at) || a.index - b.index);
  const roundNumbers = new Map();
  chronological.forEach(({ run, index }, roundIndex) => {
    roundNumbers.set(cleanString(run?.id) || String(index), roundIndex + 1);
  });

  const items = normalizedRuns.map((run, index) => {
    const id = cleanString(run?.id) || String(index);
    const roundNumber = roundNumbers.get(id) || index + 1;
    const variant = runVariant(run, roundNumber);
    const label = cleanString(run?.label) || msg(normalizedLocale, "projects.rounds.untitled");
    const queryText = cleanString(run?.query_text);
    const summary = cleanString(run?.summary);
    const description = runDescription(normalizedLocale, variant, { round: roundNumber, label });
    return {
      id,
      roundNumber,
      kind: run?.kind === "verify" ? "verify" : "search",
      variant,
      badge: msg(normalizedLocale, `projects.rounds.${variant}.badge`),
      label,
      summary,
      status: cleanString(run?.status),
      queryText,
      updatedAt: cleanString(run?.updated_at),
      description,
      nextSearchInput: run?.kind === "verify" ? "" : queryText,
      feedbackSummary: buildRoundFeedbackSummary(run, normalizedLocale),
    };
  });

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.rounds.title"),
    emptyText: msg(normalizedLocale, "projects.rounds.empty"),
    items,
  };
}

/**
 * @param {Array<{ id?: number; kind?: string; info?: string }> | undefined} feed
 */
export function extractRecentResearchItems(feed, locale = "zh") {
  const normalizedLocale = normalizeLocale(locale);
  return cleanFeed(feed)
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item?.kind === "search" || item?.kind === "fetch")
    .slice(-5)
    .reverse()
    .map(({ item, index }) => {
      const detail = eventDetail(item, normalizedLocale);
      return {
        id: item?.id ?? index,
        kind: item?.kind || "search",
        detail,
        sourceType: sourceTypeForText(detail),
      };
    });
}

/**
 * @param {Array<{ id?: number; kind?: string; info?: string }> | undefined} feed
 */
export function inferResearchCoverage(feed) {
  const counts = new Map(SOURCE_ORDER.map((key) => [key, 0]));
  for (const item of cleanFeed(feed)) {
    const detail = eventDetail(item);
    const key = sourceTypeForText(detail);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return SOURCE_ORDER.flatMap((key) => {
    const count = counts.get(key) || 0;
    return count > 0 ? [{ key, label: key, count }] : [];
  });
}

/**
 * @param {Array<{ id?: number; kind?: string; info?: string }> | undefined} feed
 */
export function buildResearchSourceGroups(feed, locale = "zh") {
  const normalizedLocale = normalizeLocale(locale);
  const groups = new Map(SOURCE_ORDER.map((key) => [key, {
    key,
    label: msg(normalizedLocale, `research.loop.source.${key}`),
    count: 0,
    latestKind: "",
    latestDetail: "",
  }]));

  for (const item of cleanFeed(feed)) {
    if (item?.kind !== "search" && item?.kind !== "fetch") continue;
    const detail = eventDetail(item, normalizedLocale);
    const key = sourceTypeForText(detail);
    const group = groups.get(key);
    if (!group) continue;
    group.count += 1;
    group.latestKind = item.kind;
    group.latestDetail = detail;
  }

  return SOURCE_ORDER.flatMap((key) => {
    const group = groups.get(key);
    return group && group.count > 0 ? [group] : [];
  });
}

/**
 * @param {{ feed?: Array<{ id?: number; kind?: string; info?: string }>; live?: { searches?: number; fetches?: number } | null; jobStatus?: { phase?: string; label?: string; detail?: string; canRetry?: boolean } | null; locale?: string }} input
 */
export function buildResearchLoopView({ feed = [], live = null, jobStatus = null, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const recentItems = extractRecentResearchItems(feed, normalizedLocale).map((item) => ({
    ...item,
    label: msg(normalizedLocale, `research.loop.event.${item.kind}`),
  }));
  const coverage = inferResearchCoverage(feed).map((item) => ({
    ...item,
    label: msg(normalizedLocale, `research.loop.source.${item.key}`),
  }));
  const sourceGroups = buildResearchSourceGroups(feed, normalizedLocale);
  const searches = Number(live?.searches ?? cleanFeed(feed).filter((item) => item?.kind === "search").length);
  const fetches = Number(live?.fetches ?? cleanFeed(feed).filter((item) => item?.kind === "fetch").length);
  const statsText = searches || fetches
    ? msg(normalizedLocale, "research.loop.stats", { searches, fetches })
    : msg(normalizedLocale, "research.loop.statsWaiting");
  const terminalPhase = ["done", "error", "canceled"].includes(jobStatus?.phase) ? jobStatus.phase : "";
  const latest = recentItems[0];
  let phaseKey = "planning";

  if (terminalPhase) {
    phaseKey = terminalPhase;
  } else if (latest?.kind === "fetch") {
    phaseKey = "fetching";
  } else if (latest?.kind === "search") {
    phaseKey = "searching";
  } else if (PHASE_KEYS.includes(jobStatus?.phase)) {
    phaseKey = jobStatus.phase;
  }

  const phaseDetail = latest && (phaseKey === "searching" || phaseKey === "fetching")
    ? latest.detail
    : cleanString(jobStatus?.detail) || msg(normalizedLocale, `research.loop.phase.${phaseKey}.detail`);

  return {
    locale: normalizedLocale,
    phase: {
      key: phaseKey,
      label: cleanString(jobStatus?.label) || msg(normalizedLocale, `research.loop.phase.${phaseKey}.label`),
      detail: phaseDetail,
    },
    statsText,
    searches,
    fetches,
    recentItems,
    coverage,
    sourceGroups,
  };
}

/**
 * @param {{ feedback?: Record<string, string | undefined>; locale?: string }} input
 */
export function buildFeedbackOptimizationPreview({ feedback = {}, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const required = ["precision", "satisfaction"].filter((key) => !cleanString(feedback?.[key]));
  if (required.length) {
    return {
      locale: normalizedLocale,
      canRun: false,
      required,
      statusText: msg(normalizedLocale, "feedback.preview.chooseCore"),
      actions: [],
    };
  }

  const actions = [];
  if (feedback.precision === "off") {
    pushUniqueAction(actions, normalizedLocale, "tighten_profile");
    pushUniqueAction(actions, normalizedLocale, "strengthen_evidence");
  } else if (feedback.precision === "partial") {
    pushUniqueAction(actions, normalizedLocale, "tighten_profile");
  }

  if (feedback.satisfaction === "unsatisfied") {
    pushUniqueAction(actions, normalizedLocale, "expand_sources");
    pushUniqueAction(actions, normalizedLocale, "adjust_candidate_pool");
  } else if (feedback.satisfaction === "mixed") {
    pushUniqueAction(actions, normalizedLocale, "expand_sources");
  }

  if (feedback.issue === "weak_evidence") pushUniqueAction(actions, normalizedLocale, "strengthen_evidence");
  if (feedback.issue === "too_few") pushUniqueAction(actions, normalizedLocale, "expand_sources");
  if (feedback.issue === "too_many" || feedback.issue === "too_broad") pushUniqueAction(actions, normalizedLocale, "tighten_profile");
  if (feedback.issue === "wrong_seniority") pushUniqueAction(actions, normalizedLocale, "adjust_seniority");
  if (feedback.issue === "wrong_direction") pushUniqueAction(actions, normalizedLocale, "adjust_candidate_pool");
  if (feedback.issue === "wrong_location") pushUniqueAction(actions, normalizedLocale, "adjust_location");

  if (feedback.focus === "stricter_match") pushUniqueAction(actions, normalizedLocale, "tighten_profile");
  if (feedback.focus === "expand_sources") pushUniqueAction(actions, normalizedLocale, "expand_sources");
  if (feedback.focus === "stronger_evidence") pushUniqueAction(actions, normalizedLocale, "strengthen_evidence");
  if (feedback.focus === "adjacent_pools") pushUniqueAction(actions, normalizedLocale, "adjust_candidate_pool");
  if (feedback.focus === "higher_seniority") pushUniqueAction(actions, normalizedLocale, "adjust_seniority");
  if (feedback.focus === "location_fit") pushUniqueAction(actions, normalizedLocale, "adjust_location");

  if (!actions.length) {
    pushUniqueAction(actions, normalizedLocale, "strengthen_evidence");
  }

  return {
    locale: normalizedLocale,
    canRun: true,
    required: [],
    statusText: msg(normalizedLocale, "feedback.preview.ready"),
    actions,
  };
}

function normalizedFeedbackValue(value) {
  return cleanString(value);
}

/**
 * @param {{ feedback?: Record<string, string | undefined>; optimizedInput?: string; createdAt?: string; locale?: string }} input
 */
export function buildPersistedSearchFeedback({ feedback = {}, optimizedInput = "", createdAt = "", locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const preview = buildFeedbackOptimizationPreview({ feedback, locale: normalizedLocale });
  const created = cleanString(createdAt) || new Date().toISOString();
  return {
    version: 1,
    precision: normalizedFeedbackValue(feedback.precision),
    satisfaction: normalizedFeedbackValue(feedback.satisfaction),
    issue: normalizedFeedbackValue(feedback.issue),
    focus: normalizedFeedbackValue(feedback.focus),
    optimization_actions: preview.actions.map((action) => action.key),
    optimized_query: cleanString(optimizedInput),
    created_at: created,
  };
}

/**
 * @param {{ result?: unknown; feedback?: Record<string, string | undefined>; optimizedInput?: string; createdAt?: string; locale?: string }} input
 */
export function mergeSearchFeedbackIntoResult({ result, feedback = {}, optimizedInput = "", createdAt = "", locale = "zh" } = {}) {
  const source = isPlainObject(result) ? result : {};
  return {
    ...source,
    search_feedback: buildPersistedSearchFeedback({
      feedback,
      optimizedInput,
      createdAt,
      locale,
    }),
  };
}

/**
 * @param {{ candidateCount?: number; runCount?: number; hasFilter?: boolean; latestRunLabel?: string; locale?: string }} input
 */
export function buildProjectNextSteps({ candidateCount = 0, runCount = 0, hasFilter = false, latestRunLabel = "", locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const candidates = Math.max(0, Number(candidateCount) || 0);
  const runs = Math.max(0, Number(runCount) || 0);
  const latestLabel = cleanString(latestRunLabel);
  const actions = [];

  if (candidates === 0) {
    actions.push(projectAction(normalizedLocale, "start_search"));
    if (runs > 0) actions.push(projectAction(normalizedLocale, "review_latest_run", { latestRunLabel: latestLabel || msg(normalizedLocale, "projects.next.latestFallback") }));
  } else {
    actions.push(projectAction(normalizedLocale, "review_candidates"));
    if (runs > 0) actions.push(projectAction(normalizedLocale, "review_latest_run", { latestRunLabel: latestLabel || msg(normalizedLocale, "projects.next.latestFallback") }));
    if (hasFilter) actions.push(projectAction(normalizedLocale, "clear_filter"));
  }

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.next.title"),
    state: hasFilter && candidates > 0 ? "filtered" : candidates === 0 ? "empty" : "active",
    latestRunLabel: latestLabel,
    actions: actions.slice(0, 3),
  };
}

/**
 * @param {{ project?: { name?: string; brief?: string | null }; runs?: Array<{ id?: string; kind?: string; label?: string; summary?: string | null; status?: string; query_text?: string; updated_at?: string; result?: unknown }>; candidateCount?: number; hasFilter?: boolean; locale?: string }} input
 */
export function buildProjectSearchConsole({ project = {}, runs = [], candidateCount = 0, hasFilter = false, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const briefText = cleanString(project?.brief) || cleanString(project?.name) || msg(normalizedLocale, "projects.noBrief");
  const rounds = buildProjectResearchRounds({ runs, locale: normalizedLocale });
  const latestRound = rounds.items[0] ? {
    id: rounds.items[0].id,
    roundNumber: rounds.items[0].roundNumber,
    kind: rounds.items[0].kind,
    badge: rounds.items[0].badge,
    label: rounds.items[0].label,
    description: rounds.items[0].description,
    summary: rounds.items[0].summary,
    status: rounds.items[0].status,
  } : null;
  const feedbackPreference = buildLatestProjectFeedbackPreference({ runs, baseInput: briefText, locale: normalizedLocale });
  const latestFeedback = feedbackPreference.canApply
    ? { title: msg(normalizedLocale, "projects.console.feedbackTitle"), items: feedbackPreference.items }
    : rounds.items.find((item) => item.feedbackSummary)?.feedbackSummary ?? null;
  const nextSearchInput = feedbackPreference.canApply
    ? feedbackPreference.optimizedInput
    : cleanString(rounds.items.find((item) => item.kind === "search" && item.nextSearchInput)?.nextSearchInput) || briefText;
  const nextSteps = buildProjectNextSteps({
    candidateCount,
    runCount: Array.isArray(runs) ? runs.length : 0,
    hasFilter,
    latestRunLabel: latestRound?.label ?? "",
    locale: normalizedLocale,
  });

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.console.title"),
    description: msg(normalizedLocale, "projects.console.desc"),
    briefTitle: msg(normalizedLocale, "projects.console.briefTitle"),
    briefText,
    latestRoundTitle: msg(normalizedLocale, "projects.console.latestRoundTitle"),
    latestRoundEmpty: msg(normalizedLocale, "projects.console.latestRoundEmpty"),
    latestRound,
    feedback: latestFeedback,
    nextSearchInput,
    nextSteps,
  };
}
