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

function projectAction(locale, key, params) {
  return {
    key,
    label: msg(locale, `projects.next.${key}.label`, params),
    detail: msg(locale, `projects.next.${key}.detail`, params),
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
