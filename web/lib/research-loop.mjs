import { t as translate } from "./i18n.mjs";

const SOURCE_ORDER = ["github", "papers", "company", "public_web"];
const PHASE_KEYS = ["planning", "queued", "retrying", "running", "searching", "fetching", "synthesizing", "shortlisting", "done", "error", "canceled"];
const RESEARCH_STAGE_ORDER = ["planning", "searching", "fetching", "synthesizing", "shortlisting"];

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

const FEEDBACK_ACTION_ORDER = [
  "tighten_profile",
  "strengthen_evidence",
  "expand_sources",
  "adjust_candidate_pool",
  "adjust_seniority",
  "adjust_location",
];

function researchStageIndex(phaseKey) {
  if (phaseKey === "queued" || phaseKey === "retrying" || phaseKey === "running") return 0;
  if (phaseKey === "done") return RESEARCH_STAGE_ORDER.length;
  if (phaseKey === "error" || phaseKey === "canceled") return -1;
  const index = RESEARCH_STAGE_ORDER.indexOf(phaseKey);
  return index >= 0 ? index : 0;
}

function buildResearchStageTimeline(locale, phaseKey) {
  const activeIndex = researchStageIndex(phaseKey);
  return RESEARCH_STAGE_ORDER.map((key, index) => {
    let state = "pending";
    if (activeIndex === RESEARCH_STAGE_ORDER.length || index < activeIndex) state = "done";
    else if (index === activeIndex) state = "active";
    return {
      key,
      state,
      label: msg(locale, `research.loop.phase.${key}.label`),
      detail: msg(locale, `research.loop.phase.${key}.detail`),
    };
  });
}

function latestFeedDetail(feed, kind, locale) {
  const items = cleanFeed(feed).filter((item) => item?.kind === kind);
  return eventDetail(items[items.length - 1], locale);
}

function localizedJoin(locale, values) {
  const items = values.map(cleanString).filter(Boolean);
  return items.join(locale === "en" ? ", " : "、");
}

function buildResearchObservability({ feed = [], coverage = [], phaseKey = "planning", locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const currentSearch = latestFeedDetail(feed, "search", normalizedLocale) || msg(normalizedLocale, "research.observability.searchWaiting");
  const currentFetch = latestFeedDetail(feed, "fetch", normalizedLocale) || msg(normalizedLocale, "research.observability.fetchWaiting");
  const coverageLabels = coverage.map((item) => msg(normalizedLocale, `research.loop.source.${item.key}`));
  const terminal = phaseKey === "done" || phaseKey === "error" || phaseKey === "canceled";
  return {
    canStop: !terminal,
    currentSearch: {
      label: msg(normalizedLocale, "research.observability.currentSearch"),
      detail: currentSearch,
    },
    currentFetch: {
      label: msg(normalizedLocale, "research.observability.currentFetch"),
      detail: currentFetch,
    },
    coverage: {
      label: msg(normalizedLocale, "research.observability.coverage"),
      detail: coverageLabels.length ? localizedJoin(normalizedLocale, coverageLabels) : msg(normalizedLocale, "research.observability.coverageWaiting"),
    },
  };
}

function researchTimelineStage(kind) {
  return kind === "fetch" ? "read" : "search";
}

function buildEvidenceTimeline({ feed = [], coverage = [], searches = 0, fetches = 0, phaseKey = "planning", locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const terminal = ["done", "error", "canceled"].includes(phaseKey);
  const items = cleanFeed(feed)
    .filter((item) => item?.kind === "search" || item?.kind === "fetch")
    .map((item) => {
      const detail = eventDetail(item, normalizedLocale);
      const stage = researchTimelineStage(item.kind);
      const sourceType = sourceTypeForText(detail);
      return {
        id: Number.isFinite(Number(item?.id)) ? Number(item.id) : 0,
        stage,
        label: msg(normalizedLocale, `research.evidenceTimeline.${stage}`),
        sourceType,
        sourceLabel: msg(normalizedLocale, `research.loop.source.${sourceType}`),
        detail,
        nextStep: msg(normalizedLocale, `research.evidenceTimeline.next.${stage}.${sourceType}`),
        state: "done",
      };
    })
    .reverse();

  if (items.length > 0 && !terminal) items[0].state = "active";

  const coverageLabels = coverage.map((item) => msg(normalizedLocale, `research.loop.source.${item.key}`));
  const detail = coverageLabels.length
    ? msg(normalizedLocale, "research.evidenceTimeline.summary", {
        searches,
        fetches,
        coverage: localizedJoin(normalizedLocale, coverageLabels),
      })
    : msg(normalizedLocale, "research.evidenceTimeline.summaryWaiting", { searches, fetches });

  return {
    summary: {
      label: msg(normalizedLocale, "research.evidenceTimeline.title"),
      detail,
    },
    items,
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

function candidateName(candidate, locale = "en") {
  return cleanString(candidate?.name) || (normalizeLocale(locale) === "zh" ? "未知候选人" : "Unknown candidate");
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

function candidateEvidenceGapClaims(candidate) {
  const claims = Array.isArray(candidate?.claims) ? candidate.claims : [];
  return claims
    .filter((claim) => {
      const verdict = cleanString(claim?.verdict).toLowerCase();
      return verdict === "unverified" || verdict === "contradicted";
    })
    .map((claim) => cleanString(claim?.claim))
    .filter(Boolean)
    .slice(0, 5);
}

function candidateBackfillSourceTypes(candidate) {
  const types = new Set();
  const links = isPlainObject(candidate?.links) ? candidate.links : {};
  if (!cleanString(links.github)) types.add("code");
  if (!cleanString(links.scholar)) types.add("paper");
  if (!cleanString(links.linkedin)) types.add("profile");
  if (!cleanString(links.website)) types.add("company");
  types.add("blog");
  return Array.from(types).slice(0, 5);
}

const CANDIDATE_BACKFILL_INPUT_COPY = {
  zh: {
    title: "SignalHire 候选人证据补搜。",
    candidate: "候选人：{value}",
    role: "角色/背景：{value}",
    roleUnknown: "角色未知",
    directions: "AI 方向：{value}",
    notSpecified: "未指定",
    quality: "当前证据质量：{value}",
    qualityUnknown: "未知",
    gaps: "证据缺口：{value}",
    defaultGap: "整体证据较弱或交叉验证不足",
    sourceTypes: "需要检查的来源类型：{value}",
    goal: "搜索目标：找到具体公开来源，用来确认、反驳或更新该候选人的匹配判断。",
    prioritize: "优先查找研究、代码、公司/工作经历、公开写作、演讲和个人资料等独立 URL。",
    returnPayload: "返回聚焦该候选人证据补搜的标准 SignalHire 人才 shortlist payload，不要引用搜索结果页 URL。",
  },
  en: {
    title: "Candidate evidence backfill search for SignalHire.",
    candidate: "Candidate: {value}",
    role: "Role/context: {value}",
    roleUnknown: "role unknown",
    directions: "AI directions: {value}",
    notSpecified: "not specified",
    quality: "Current evidence quality: {value}",
    qualityUnknown: "unknown",
    gaps: "Evidence gaps: {value}",
    defaultGap: "overall evidence is weak or insufficiently cross-validated",
    sourceTypes: "Source types to check: {value}",
    goal: "Search goal: find concrete public sources that confirm, contradict, or update this candidate's fit.",
    prioritize: "Prioritize independent URLs across research, code, company/work history, public writing, talks, and profile sources.",
    returnPayload: "Return the normal SignalHire talent shortlist payload focused on this candidate evidence backfill. Do not cite search-result URLs.",
  },
};

function candidateBackfillInputCopy(locale, key, params = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  let text = CANDIDATE_BACKFILL_INPUT_COPY[normalizedLocale][key] ?? CANDIDATE_BACKFILL_INPUT_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

const CANDIDATE_BACKFILL_SOURCE_TYPE_LABELS = {
  zh: {
    code: "代码",
    paper: "论文",
    profile: "个人资料",
    company: "公司页",
    blog: "公开写作",
  },
  en: {
    code: "code",
    paper: "paper",
    profile: "profile",
    company: "company",
    blog: "blog",
  },
};

function candidateBackfillSourceTypeLabels(sourceTypes, locale) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const labels = CANDIDATE_BACKFILL_SOURCE_TYPE_LABELS[normalizedLocale];
  return sourceTypes.map((type) => labels[type] ?? type);
}

function buildCandidateEvidenceBackfillInput(item, locale = "zh") {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const candidate = isPlainObject(item?.candidate) ? item.candidate : {};
  const name = candidateName(candidate, normalizedLocale);
  const subtitle = candidateSubtitle(candidate) || candidateBackfillInputCopy(normalizedLocale, "roleUnknown");
  const quality = cleanString(candidate?.evidence_audit?.overall_evidence_quality) || candidateBackfillInputCopy(normalizedLocale, "qualityUnknown");
  const directions = Array.isArray(candidate?.ai_directions) ? candidate.ai_directions.map(cleanString).filter(Boolean).join(", ") : "";
  const gapClaims = candidateEvidenceGapClaims(candidate);
  const sourceTypes = candidateBackfillSourceTypes(candidate);
  const sourceTypeLabels = candidateBackfillSourceTypeLabels(sourceTypes, normalizedLocale);
  return [
    candidateBackfillInputCopy(normalizedLocale, "title"),
    candidateBackfillInputCopy(normalizedLocale, "candidate", { value: name }),
    candidateBackfillInputCopy(normalizedLocale, "role", { value: subtitle }),
    candidateBackfillInputCopy(normalizedLocale, "directions", { value: directions || candidateBackfillInputCopy(normalizedLocale, "notSpecified") }),
    candidateBackfillInputCopy(normalizedLocale, "quality", { value: quality }),
    candidateBackfillInputCopy(normalizedLocale, "gaps", { value: gapClaims.length ? gapClaims.join("; ") : candidateBackfillInputCopy(normalizedLocale, "defaultGap") }),
    candidateBackfillInputCopy(normalizedLocale, "sourceTypes", { value: localizedJoin(normalizedLocale, sourceTypeLabels) }),
    candidateBackfillInputCopy(normalizedLocale, "goal"),
    candidateBackfillInputCopy(normalizedLocale, "prioritize"),
    candidateBackfillInputCopy(normalizedLocale, "returnPayload"),
  ].join("\n");
}

function decisionQueueReason(locale, key, item) {
  const name = candidateName(item?.candidate, locale);
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
      name: candidateName(item.candidate, normalizedLocale),
      subtitle: candidateSubtitle(item.candidate),
      matchScore: Number.isFinite(Number(item.candidate?.match_score)) ? Math.round(Number(item.candidate.match_score)) : null,
      reason: decisionQueueReason(normalizedLocale, key, item),
      canBackfill: key === "needs_evidence",
      backfillInput: key === "needs_evidence" ? buildCandidateEvidenceBackfillInput(item, normalizedLocale) : "",
    });
  }

  for (const column of columns) column.count = column.items.length;
  return { locale: normalizedLocale, columns };
}

const ACTION_BRIEF_COPY = {
  zh: {
    title: "今日待处理",
    emptySummary: "本项目还没有候选人。先启动一轮项目搜人，建立第一版候选池。",
    summary: "{total} 位候选人中，{needsEvidence} 位需补证据、{review} 位待评估、{interested} 位推进中。",
    primaryEmptyLabel: "启动本项目搜人",
    primaryEmptyDetail: "候选池为空，先用项目画像启动第一轮搜索。",
    primaryNeedsEvidenceLabel: "先补证据",
    primaryNeedsEvidenceDetail: "{name} 的公开证据仍偏弱，先补齐可交叉验证来源再判断。",
    primaryReviewLabel: "先评估候选人",
    primaryReviewDetail: "{name} 还未处理，建议先查看候选人阅读摘要和证据档案。",
    primaryInterestedLabel: "推进沟通",
    primaryInterestedDetail: "{name} 已进入沟通或面试流程，继续推进下一步动作。",
    needsEvidenceLabel: "补证据",
    reviewLabel: "评估候选人",
    interestedLabel: "推进沟通",
    rejectedLabel: "已排除",
  },
  en: {
    title: "Today",
    emptySummary: "This project has no candidates yet. Start a project search to build the first shortlist.",
    summary: "Across {total} candidates: {needsEvidence} need evidence, {review} need review, and {interested} are in progress.",
    primaryEmptyLabel: "Start project search",
    primaryEmptyDetail: "The candidate pool is empty. Start the first search from the project brief.",
    primaryNeedsEvidenceLabel: "Backfill evidence first",
    primaryNeedsEvidenceDetail: "{name} still has weak public evidence. Fill cross-checkable sources before deciding.",
    primaryReviewLabel: "Review candidates first",
    primaryReviewDetail: "{name} has not been handled yet. Read the candidate summary and evidence dossier first.",
    primaryInterestedLabel: "Progress outreach",
    primaryInterestedDetail: "{name} is already in outreach or interview flow. Continue the next action.",
    needsEvidenceLabel: "Backfill evidence",
    reviewLabel: "Review candidates",
    interestedLabel: "Progress outreach",
    rejectedLabel: "Excluded",
  },
};

function actionBriefCopy(locale, key, params = {}) {
  let text = ACTION_BRIEF_COPY[locale === "en" ? "en" : "zh"][key] ?? ACTION_BRIEF_COPY.zh[key];
  for (const [name, value] of Object.entries(params)) text = text.replace(`{${name}}`, String(value));
  return text;
}

function columnFromQueue(queue, key) {
  return queue.columns.find((column) => column.key === key) ?? { key, count: 0, items: [] };
}

function actionBriefAction(locale, key, column, labelKey) {
  const first = column.items[0] ?? {};
  return {
    key,
    count: column.count,
    label: actionBriefCopy(locale, labelKey),
    detail: first.reason || "",
    targetItemId: first.id || "",
    backfillInput: first.backfillInput || "",
  };
}

/**
 * @param {{ items?: unknown[]; locale?: string }} input
 */
export function buildProjectActionBrief({ items = [], locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const queue = buildProjectCandidateDecisionQueue({ items, locale: normalizedLocale });
  const needsEvidence = columnFromQueue(queue, "needs_evidence");
  const review = columnFromQueue(queue, "review");
  const interested = columnFromQueue(queue, "interested");
  const rejected = columnFromQueue(queue, "rejected");
  const total = queue.columns.reduce((sum, column) => sum + column.count, 0);
  const primaryColumn = needsEvidence.count > 0 ? needsEvidence : review.count > 0 ? review : interested.count > 0 ? interested : null;
  const primaryKey = primaryColumn?.key ?? "start_search";
  const primaryItem = primaryColumn?.items?.[0] ?? {};
  const primaryCopyKey = {
    needs_evidence: "primaryNeedsEvidence",
    review: "primaryReview",
    interested: "primaryInterested",
    start_search: "primaryEmpty",
  }[primaryKey] ?? "primaryEmpty";
  const actions = [
    needsEvidence.count > 0 ? actionBriefAction(normalizedLocale, "needs_evidence", needsEvidence, "needsEvidenceLabel") : null,
    review.count > 0 ? actionBriefAction(normalizedLocale, "review", review, "reviewLabel") : null,
    interested.count > 0 ? actionBriefAction(normalizedLocale, "interested", interested, "interestedLabel") : null,
    rejected.count > 0 ? actionBriefAction(normalizedLocale, "rejected", rejected, "rejectedLabel") : null,
  ].filter(Boolean);

  return {
    locale: normalizedLocale,
    title: actionBriefCopy(normalizedLocale, "title"),
    summary: total > 0
      ? actionBriefCopy(normalizedLocale, "summary", {
          total,
          needsEvidence: needsEvidence.count,
          review: review.count,
          interested: interested.count,
        })
      : actionBriefCopy(normalizedLocale, "emptySummary"),
    primaryAction: {
      key: primaryKey,
      label: actionBriefCopy(normalizedLocale, `${primaryCopyKey}Label`),
      detail: actionBriefCopy(normalizedLocale, `${primaryCopyKey}Detail`, {
        name: primaryItem.name || (normalizedLocale === "en" ? "This candidate" : "这位候选人"),
      }),
      targetItemId: primaryItem.id || "",
      backfillInput: primaryItem.backfillInput || "",
    },
    actions,
  };
}

function projectAction(locale, key, params) {
  return {
    key,
    label: msg(locale, `projects.next.${key}.label`, params),
    detail: msg(locale, `projects.next.${key}.detail`, params),
  };
}

function projectPriority(locale, key, params) {
  return {
    key,
    label: msg(locale, `projects.priorities.${key}.label`, params),
    detail: msg(locale, `projects.priorities.${key}.detail`, params),
  };
}

function queueCount(queue, key) {
  return queue.columns.find((column) => column.key === key)?.count ?? 0;
}

function uniqueCleanStrings(values, limit = 5) {
  const seen = new Set();
  const results = [];
  for (const value of values) {
    const text = cleanString(value);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    results.push(text);
    if (results.length >= limit) break;
  }
  return results;
}

function localizedList(locale, values) {
  const items = uniqueCleanStrings(values, 4);
  if (!items.length) return "";
  return items.join(locale === "en" ? ", " : "、");
}

function candidateDirectionSignals(candidate) {
  const directions = Array.isArray(candidate?.ai_directions) ? candidate.ai_directions : [];
  const skills = Array.isArray(candidate?.skills) ? candidate.skills : [];
  return uniqueCleanStrings([
    ...directions,
    ...skills,
    candidate?.headline,
    candidateSubtitle(candidate),
  ], 4);
}

function projectRefinementCopy(locale, key, params = {}) {
  const copies = {
    zh: {
      avoid_rejected_patterns: {
        label: "避开已拒绝画像",
        detail: `已有 ${params.count} 位候选人被标记为不合适，下一轮降低这些方向权重：${params.patterns || "上一轮不合适画像"}。`,
        instruction: `避开已拒绝画像：降低 ${params.patterns || "上一轮不合适画像"} 的权重，寻找更贴近项目画像的人选。`,
      },
      strengthen_evidence: {
        label: "强化证据核验",
        detail: `${params.count} 位候选人证据不足，下一轮优先补论文、代码、项目、任职和公开资料的交叉验证。`,
        instruction: "优先交叉核验：要求候选人具备可公开验证的论文、代码、项目、任职或技术写作证据。",
      },
      find_similar_to_active: {
        label: "扩展相似强信号",
        detail: `${params.names || "已推进候选人"} 已进入推进中，下一轮寻找相似方向但来源更丰富的人选。`,
        instruction: `参考已推进候选人：围绕 ${params.names || "已联系或面试候选人"} 的强匹配方向，扩展相似人才池。`,
      },
    },
    en: {
      avoid_rejected_patterns: {
        label: "Avoid rejected patterns",
        detail: `${params.count} candidates are marked as not a fit. Lower weight for these directions: ${params.patterns || "the rejected profile patterns"}.`,
        instruction: `Avoid rejected patterns: lower weight for ${params.patterns || "the rejected profile patterns"} and search closer-fit profiles.`,
      },
      strengthen_evidence: {
        label: "Strengthen evidence checks",
        detail: `${params.count} candidates have weak evidence. Prioritize cross-checkable papers, code, projects, role history, and public sources next round.`,
        instruction: "Prioritize cross-validation: require public evidence across papers, code, projects, role history, or technical writing.",
      },
      find_similar_to_active: {
        label: "Expand similar strong signals",
        detail: `${params.names || "Active candidates"} are already moving forward. Search similar directions with richer source coverage next round.`,
        instruction: `Use active candidates as positive signals: expand similar talent pools around ${params.names || "contacted or interviewing candidates"}.`,
      },
    },
  };
  return (locale === "en" ? copies.en : copies.zh)[key];
}

/**
 * @param {{ items?: unknown[]; locale?: string }} input
 */
export function buildProjectSearchRefinementSuggestions({ items = [], locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedItems = Array.isArray(items) ? items.filter(isPlainObject) : [];
  const rejected = normalizedItems.filter((item) => cleanString(item?.status) === "rejected");
  const needsEvidence = normalizedItems.filter((item) => cleanString(item?.status) !== "hired" && candidateEvidenceRisk(item?.candidate));
  const active = normalizedItems.filter((item) => ["contacted", "interviewing", "hired"].includes(cleanString(item?.status)));
  const suggestions = [];

  if (rejected.length) {
    const patterns = localizedList(normalizedLocale, rejected.flatMap((item) => candidateDirectionSignals(item?.candidate)));
    suggestions.push({ key: "avoid_rejected_patterns", ...projectRefinementCopy(normalizedLocale, "avoid_rejected_patterns", { count: rejected.length, patterns }) });
  }
  if (needsEvidence.length) {
    suggestions.push({ key: "strengthen_evidence", ...projectRefinementCopy(normalizedLocale, "strengthen_evidence", { count: needsEvidence.length }) });
  }
  if (active.length) {
    const names = localizedList(normalizedLocale, active.map((item) => candidateName(item?.candidate)));
    suggestions.push({ key: "find_similar_to_active", ...projectRefinementCopy(normalizedLocale, "find_similar_to_active", { names }) });
  }

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.refinements.title"),
    items: suggestions.slice(0, 3),
  };
}

function appendSearchRefinementInstructions(input, refinements) {
  const base = cleanString(input);
  const instructions = Array.isArray(refinements?.items)
    ? refinements.items.map((item) => cleanString(item.instruction)).filter(Boolean)
    : [];
  if (!base || !instructions.length) return base;
  return `${base}\n\n${msg(refinements.locale, "projects.refinements.searchSection")}\n- ${instructions.join("\n- ")}`;
}

function feedbackFromCandidate(candidate) {
  if (isPlainObject(candidate?.feedback)) return candidate.feedback;
  if (isPlainObject(candidate?.candidate_feedback)) return candidate.candidate_feedback;
  return null;
}

/**
 * @param {{ items?: unknown[]; locale?: string }} input
 */
export function buildProjectCandidateFeedbackSignals({ items = [], locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const aggregates = new Map();
  const normalizedItems = Array.isArray(items) ? items.filter(isPlainObject) : [];

  for (const item of normalizedItems) {
    const candidate = isPlainObject(item?.candidate) ? item.candidate : {};
    const feedback = feedbackFromCandidate(candidate);
    if (!feedback) continue;
    const preview = buildFeedbackOptimizationPreview({ feedback, locale: normalizedLocale });
    if (!preview.canRun) continue;
    const name = candidateName(candidate);
    for (const action of preview.actions) {
      if (!aggregates.has(action.key)) {
        aggregates.set(action.key, {
          key: action.key,
          label: action.label,
          detail: action.detail,
          names: [],
          count: 0,
        });
      }
      const aggregate = aggregates.get(action.key);
      aggregate.count += 1;
      if (!aggregate.names.some((existing) => existing.toLowerCase() === name.toLowerCase())) aggregate.names.push(name);
    }
  }

  const itemsOut = Array.from(aggregates.values())
    .sort((a, b) => FEEDBACK_ACTION_ORDER.indexOf(a.key) - FEEDBACK_ACTION_ORDER.indexOf(b.key))
    .slice(0, 3)
    .map((item) => {
      const names = localizedList(normalizedLocale, item.names);
      return {
        key: item.key,
        label: item.label,
        detail: msg(normalizedLocale, "projects.candidateFeedbackSignals.detail", { count: item.count, names, action: item.label }),
        instruction: `${item.label}: ${item.detail}`,
      };
    });

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.candidateFeedbackSignals.title"),
    items: itemsOut,
    empty: itemsOut.length === 0,
  };
}

/**
 * @param {{ items?: unknown[]; locale?: string }} input
 */
export function buildProjectCandidateFeedbackSummary({ items = [], locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedItems = Array.isArray(items) ? items.filter(isPlainObject) : [];
  const reviewedNames = [];

  for (const item of normalizedItems) {
    const candidate = isPlainObject(item?.candidate) ? item.candidate : {};
    const feedback = feedbackFromCandidate(candidate);
    if (!feedback) continue;
    const preview = buildFeedbackOptimizationPreview({ feedback, locale: normalizedLocale });
    if (!preview.canRun) continue;
    const name = candidateName(candidate);
    if (!reviewedNames.some((existing) => existing.toLowerCase() === name.toLowerCase())) reviewedNames.push(name);
  }

  const signals = buildProjectCandidateFeedbackSignals({ items: normalizedItems, locale: normalizedLocale });
  const reviewedCount = reviewedNames.length;
  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.candidateFeedbackSummary.title"),
    empty: reviewedCount === 0,
    reviewedCount,
    summary: reviewedCount > 0
      ? msg(normalizedLocale, "projects.candidateFeedbackSummary.summary", { count: reviewedCount })
      : msg(normalizedLocale, "projects.candidateFeedbackSummary.emptySummary"),
    nextSearchHint: reviewedCount > 0
      ? msg(normalizedLocale, "projects.candidateFeedbackSummary.nextSearchHint")
      : msg(normalizedLocale, "projects.candidateFeedbackSummary.emptyHint"),
    items: signals.items,
  };
}

function appendCandidateFeedbackInstructions(input, feedbackSignals) {
  const base = cleanString(input);
  const instructions = Array.isArray(feedbackSignals?.items)
    ? feedbackSignals.items.map((item) => cleanString(item.instruction)).filter(Boolean)
    : [];
  if (!base || !instructions.length) return base;
  return `${base}\n\n${msg(feedbackSignals.locale, "projects.candidateFeedbackSignals.searchSection")}\n- ${instructions.join("\n- ")}`;
}

function constraintChangeType(key) {
  if (key === "avoid_rejected_patterns" || key === "adjust_candidate_pool") return "reduce";
  if (key === "expand_sources" || key === "find_similar_to_active") return "add";
  return "strengthen";
}

function constraintChangeTypeLabel(locale, type) {
  return msg(locale, `projects.constraintDiff.type.${type}`);
}

function buildConstraintChange({ item, sourceLabel, locale }) {
  const key = cleanString(item?.key) || "constraint";
  const type = constraintChangeType(key);
  return {
    key,
    type,
    typeLabel: constraintChangeTypeLabel(locale, type),
    sourceLabel,
    label: cleanString(item?.label),
    detail: cleanString(item?.detail),
  };
}

function buildFeedbackPreferenceConstraintChanges({ feedbackPreference, locale }) {
  if (!feedbackPreference?.canApply || !Array.isArray(feedbackPreference.items)) return [];
  return feedbackPreference.items.map((item) => ({
    key: `feedback_${cleanString(item?.key) || "preference"}`,
    type: "strengthen",
    typeLabel: constraintChangeTypeLabel(locale, "strengthen"),
    sourceLabel: msg(locale, "projects.console.feedbackTitle"),
    label: `${cleanString(item?.label)}: ${cleanString(item?.value)}`,
    detail: cleanString(feedbackPreference.detail) || msg(locale, "projects.constraintDiff.savedFeedbackDetail"),
  }));
}

function buildNextSearchConstraintDiff({ baseInput = "", optimizedInput = "", refinements = {}, candidateFeedbackSignals = {}, feedbackPreference = {}, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const originalInput = cleanString(baseInput);
  const finalInput = cleanString(optimizedInput) || originalInput;
  const changes = feedbackPreference?.canApply
    ? buildFeedbackPreferenceConstraintChanges({ feedbackPreference, locale: normalizedLocale })
    : [
        ...(Array.isArray(refinements?.items)
          ? refinements.items.map((item) => buildConstraintChange({
              item,
              sourceLabel: cleanString(refinements?.title) || msg(normalizedLocale, "projects.refinements.title"),
              locale: normalizedLocale,
            }))
          : []),
        ...(Array.isArray(candidateFeedbackSignals?.items)
          ? candidateFeedbackSignals.items.map((item) => buildConstraintChange({
              item,
              sourceLabel: cleanString(candidateFeedbackSignals?.title) || msg(normalizedLocale, "projects.candidateFeedbackSignals.title"),
              locale: normalizedLocale,
            }))
          : []),
      ];

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.constraintDiff.title"),
    originalTitle: msg(normalizedLocale, "projects.constraintDiff.originalTitle"),
    optimizedTitle: msg(normalizedLocale, "projects.constraintDiff.optimizedTitle"),
    originalInput,
    optimizedInput: finalInput,
    editableHint: msg(normalizedLocale, "projects.constraintDiff.editableHint"),
    changes,
    empty: changes.length === 0 && originalInput === finalInput,
  };
}

function normalizedSectionTitle(value) {
  return cleanString(value).replace(/[:：]\s*$/, "");
}

function sectionKeyForTitle(title, locale) {
  const normalized = normalizedSectionTitle(title).toLowerCase();
  const projectRefinements = normalizedSectionTitle(msg(locale, "projects.refinements.searchSection")).toLowerCase();
  const candidateFeedback = normalizedSectionTitle(msg(locale, "projects.candidateFeedbackSignals.searchSection")).toLowerCase();
  if (normalized === projectRefinements) return "project_refinements";
  if (normalized === candidateFeedback) return "candidate_feedback";
  return `section_${normalized.replace(/\s+/g, "_") || "constraints"}`;
}

function labelForConstraintSection(key, fallback, locale) {
  if (key === "project_refinements") return normalizedSectionTitle(msg(locale, "projects.refinements.searchSection"));
  if (key === "candidate_feedback") return normalizedSectionTitle(msg(locale, "projects.candidateFeedbackSignals.searchSection"));
  return normalizedSectionTitle(fallback) || msg(locale, "search.constraintEditor.sectionFallback");
}

/**
 * @param {{ input?: string; locale?: string }} input
 */
export function buildSearchConstraintEditor({ input = "", locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const lines = cleanString(input).split(/\r?\n/);
  const baseLines = [];
  const sections = [];
  let currentSection = null;

  for (const rawLine of lines) {
    const line = cleanString(rawLine);
    if (!line) continue;
    const sectionTitle = /[:：]$/.test(line) ? line : "";
    if (sectionTitle) {
      if (currentSection) sections.push(currentSection);
      const key = sectionKeyForTitle(sectionTitle, normalizedLocale);
      currentSection = {
        key,
        label: labelForConstraintSection(key, sectionTitle, normalizedLocale),
        items: [],
      };
      continue;
    }
    if (currentSection) {
      currentSection.items.push(line.replace(/^[-*]\s*/, ""));
    } else {
      baseLines.push(line);
    }
  }
  if (currentSection) sections.push(currentSection);

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.map(cleanString).filter(Boolean),
    }))
    .filter((section) => section.items.length > 0);

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "search.constraintEditor.title"),
    description: msg(normalizedLocale, "search.constraintEditor.description"),
    base: {
      label: msg(normalizedLocale, "search.constraintEditor.baseLabel"),
      value: baseLines.join("\n"),
    },
    sections: filteredSections,
    empty: !baseLines.length && filteredSections.length === 0,
  };
}

/**
 * @param {{ editor?: { base?: { value?: string }; sections?: Array<{ label?: string; items?: string[] }> } }} input
 */
export function buildSearchInputFromConstraintEditor({ editor = {} } = {}) {
  const base = cleanString(editor?.base?.value);
  const sections = Array.isArray(editor?.sections) ? editor.sections : [];
  const chunks = [];
  if (base) chunks.push(base);
  for (const section of sections) {
    const label = normalizedSectionTitle(section?.label);
    const items = Array.isArray(section?.items) ? section.items.map(cleanString).filter(Boolean) : [];
    if (!label || !items.length) continue;
    chunks.push(`${label}：\n- ${items.join("\n- ")}`);
  }
  return chunks.join("\n\n");
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
    sourceLabel: msg(normalizedLocale, `research.loop.source.${item.sourceType}`),
    intent: msg(normalizedLocale, `research.loop.intent.${item.kind}.${item.sourceType}`),
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
  } else if (jobStatus?.phase === "synthesizing" || jobStatus?.phase === "shortlisting") {
    phaseKey = jobStatus.phase;
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
  const evidenceTimeline = buildEvidenceTimeline({
    feed,
    coverage,
    searches,
    fetches,
    phaseKey,
    locale: normalizedLocale,
  });

  return {
    locale: normalizedLocale,
    phase: {
      key: phaseKey,
      label: cleanString(jobStatus?.label) || msg(normalizedLocale, `research.loop.phase.${phaseKey}.label`),
      detail: phaseDetail,
    },
    stageTimeline: buildResearchStageTimeline(normalizedLocale, phaseKey),
    statsText,
    searches,
    fetches,
    recentItems,
    coverage,
    sourceGroups,
    observability: buildResearchObservability({ feed, coverage, phaseKey, locale: normalizedLocale }),
    evidenceTimeline: evidenceTimeline.items,
    evidenceTimelineSummary: evidenceTimeline.summary,
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
 * @param {{ items?: unknown[]; feedbackPreference?: { canApply?: boolean }; candidateCount?: number; locale?: string }} input
 */
function buildProjectCommandPriorities({ items = [], feedbackPreference = {}, candidateCount = 0, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const queue = buildProjectCandidateDecisionQueue({ items, locale: normalizedLocale });
  const needsEvidenceCount = queueCount(queue, "needs_evidence");
  const reviewCount = queueCount(queue, "review");
  const interestedCount = queueCount(queue, "interested");
  const totalCandidates = Math.max(0, Number(candidateCount) || 0);
  const actions = [];

  if (needsEvidenceCount > 0) {
    actions.push(projectPriority(normalizedLocale, "backfill_evidence", { count: needsEvidenceCount }));
  }
  if (feedbackPreference?.canApply) {
    actions.push(projectPriority(normalizedLocale, "apply_feedback"));
  }
  if (reviewCount > 0) {
    actions.push(projectPriority(normalizedLocale, "review_candidates", { count: reviewCount }));
  }
  if (actions.length < 3 && interestedCount > 0) {
    actions.push(projectPriority(normalizedLocale, "progress_candidates", { count: interestedCount }));
  }
  if (!actions.length && totalCandidates === 0) {
    actions.push(projectPriority(normalizedLocale, "start_search"));
  }

  return {
    title: msg(normalizedLocale, "projects.priorities.title"),
    items: actions.slice(0, 3),
  };
}

/**
 * @param {{ project?: { name?: string; brief?: string | null }; runs?: Array<{ id?: string; kind?: string; label?: string; summary?: string | null; status?: string; query_text?: string; updated_at?: string; result?: unknown }>; items?: unknown[]; candidateCount?: number; hasFilter?: boolean; locale?: string }} input
 */
export function buildProjectSearchConsole({ project = {}, runs = [], items = [], candidateCount = 0, hasFilter = false, locale = "zh" } = {}) {
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
  const refinementSuggestions = buildProjectSearchRefinementSuggestions({ items, locale: normalizedLocale });
  const candidateFeedbackSignals = buildProjectCandidateFeedbackSignals({ items, locale: normalizedLocale });
  const nextSearchBase = feedbackPreference.canApply
    ? feedbackPreference.optimizedInput
    : cleanString(rounds.items.find((item) => item.kind === "search" && item.nextSearchInput)?.nextSearchInput) || briefText;
  const nextSearchInput = feedbackPreference.canApply
    ? nextSearchBase
    : appendCandidateFeedbackInstructions(appendSearchRefinementInstructions(nextSearchBase, refinementSuggestions), candidateFeedbackSignals);
  const nextSteps = buildProjectNextSteps({
    candidateCount,
    runCount: Array.isArray(runs) ? runs.length : 0,
    hasFilter,
    latestRunLabel: latestRound?.label ?? "",
    locale: normalizedLocale,
  });
  const priorities = buildProjectCommandPriorities({
    items,
    feedbackPreference,
    candidateCount,
    locale: normalizedLocale,
  });
  const constraintDiff = buildNextSearchConstraintDiff({
    baseInput: nextSearchBase,
    optimizedInput: nextSearchInput,
    refinements: refinementSuggestions,
    candidateFeedbackSignals,
    feedbackPreference,
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
    refinementSuggestions,
    candidateFeedbackSignals,
    constraintDiff,
    nextSteps,
    priorities,
  };
}

/**
 * @param {{ project?: { name?: string; brief?: string | null }; runs?: Array<{ id?: string; kind?: string; label?: string; summary?: string | null; status?: string; query_text?: string; updated_at?: string; result?: unknown }>; items?: unknown[]; candidateCount?: number; hasFilter?: boolean; hasCandidateDecisionQueuePanel?: boolean; hasResearchRoundsPanel?: boolean; hasSearchConstraintDiffPanel?: boolean; hasProjectHeaderBrief?: boolean; hasCandidateFeedbackSignalsPanel?: boolean; locale?: string }} input
 */
export function buildProjectControlRoom({ project = {}, runs = [], items = [], candidateCount = 0, hasFilter = false, hasCandidateDecisionQueuePanel = false, hasResearchRoundsPanel = false, hasSearchConstraintDiffPanel = false, hasProjectHeaderBrief = false, hasCandidateFeedbackSignalsPanel = false, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const briefText = cleanString(project?.brief) || cleanString(project?.name);
  const consoleView = buildProjectSearchConsole({
    project,
    runs,
    items,
    candidateCount,
    hasFilter,
    locale: normalizedLocale,
  });
  const queue = buildProjectCandidateDecisionQueue({ items, locale: normalizedLocale });
  const actionBrief = buildProjectActionBrief({ items, locale: normalizedLocale });
  const feedbackSummary = buildProjectCandidateFeedbackSummary({ items, locale: normalizedLocale });
  const roundCount = Array.isArray(runs) ? runs.length : 0;
  const nextChangeCount = consoleView.constraintDiff.changes.length;
  const needsEvidenceCount = queueCount(queue, "needs_evidence");
  const latestLabel = consoleView.latestRound?.label || msg(normalizedLocale, "projects.controlRoom.cards.rounds.empty");

  return {
    locale: normalizedLocale,
    title: msg(normalizedLocale, "projects.controlRoom.title"),
    description: msg(normalizedLocale, "projects.controlRoom.desc"),
    focusTitle: msg(normalizedLocale, "projects.controlRoom.focusTitle"),
    focus: {
      key: actionBrief.primaryAction.key,
      label: actionBrief.primaryAction.label,
      detail: actionBrief.summary,
      actionDetail: actionBrief.primaryAction.detail,
      targetItemId: actionBrief.primaryAction.targetItemId,
      backfillInput: actionBrief.primaryAction.backfillInput,
    },
    nextSteps: consoleView.nextSteps,
    cards: [
      {
        key: "brief",
        label: msg(normalizedLocale, "projects.controlRoom.cards.brief.label"),
        value: briefText
          ? msg(normalizedLocale, "projects.controlRoom.cards.brief.defined")
          : msg(normalizedLocale, "projects.controlRoom.cards.brief.empty"),
        detail: msg(normalizedLocale, "projects.controlRoom.cards.brief.detail", {
          brief: briefText || msg(normalizedLocale, "projects.noBrief"),
        }),
      },
      {
        key: "feedback",
        label: msg(normalizedLocale, "projects.controlRoom.cards.feedback.label"),
        value: String(feedbackSummary.reviewedCount),
        detail: msg(normalizedLocale, "projects.controlRoom.cards.feedback.detail", {
          summary: feedbackSummary.summary,
        }),
      },
      {
        key: "next_search",
        label: msg(normalizedLocale, "projects.controlRoom.cards.nextSearch.label"),
        value: String(nextChangeCount),
        detail: msg(normalizedLocale, "projects.controlRoom.cards.nextSearch.detail", {
          title: consoleView.constraintDiff.title,
          count: nextChangeCount,
        }),
      },
      {
        key: "rounds",
        label: msg(normalizedLocale, "projects.controlRoom.cards.rounds.label"),
        value: String(roundCount),
        detail: msg(normalizedLocale, "projects.controlRoom.cards.rounds.detail", {
          count: roundCount,
          latest: latestLabel,
        }),
      },
      {
        key: "queue",
        label: msg(normalizedLocale, "projects.controlRoom.cards.queue.label"),
        value: String(needsEvidenceCount),
        detail: msg(normalizedLocale, "projects.controlRoom.cards.queue.detail", {
          count: needsEvidenceCount,
        }),
      },
    ].filter((card) => !(hasCandidateDecisionQueuePanel && card.key === "queue") && !(hasResearchRoundsPanel && card.key === "rounds") && !(hasSearchConstraintDiffPanel && card.key === "next_search") && !(hasProjectHeaderBrief && card.key === "brief") && !(hasCandidateFeedbackSignalsPanel && card.key === "feedback")),
  };
}

/**
 * @param {{ hasCandidates?: boolean; hasControlRoom?: boolean; hasProjectEvidenceMatrix?: boolean; hasStatusFunnel?: boolean; hasResearchRounds?: boolean; hasSearchConsolePriorities?: boolean; hasResearchRoundFeedback?: boolean; hasSearchConsoleFeedback?: boolean; hasConstraintDiffRefinements?: boolean; hasSearchRefinementSuggestions?: boolean; hasConstraintDiffCandidateFeedback?: boolean; hasCandidateFeedbackSignals?: boolean; hasHeaderBrief?: boolean; hasSearchConsoleBrief?: boolean; hasCandidateStatusTabs?: boolean; locale?: string }} input
 */
export function buildProjectDetailHierarchy({ hasCandidates = false, hasControlRoom = true, hasProjectEvidenceMatrix = false, hasStatusFunnel = false, hasResearchRounds = false, hasSearchConsolePriorities = false, hasResearchRoundFeedback = false, hasSearchConsoleFeedback = false, hasConstraintDiffRefinements = false, hasSearchRefinementSuggestions = false, hasConstraintDiffCandidateFeedback = false, hasCandidateFeedbackSignals = false, hasHeaderBrief = false, hasSearchConsoleBrief = false, hasCandidateStatusTabs = false, locale = "zh" } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const hidden = [
    ...(hasControlRoom ? ["action_brief", "candidate_feedback_summary"] : []),
    ...(hasProjectEvidenceMatrix ? ["candidate_evidence_priority", "candidate_comparison"] : []),
    ...(hasStatusFunnel ? ["kpi_strip"] : []),
    ...(hasResearchRounds ? ["latest_round_summary"] : []),
    ...(hasControlRoom && hasSearchConsolePriorities ? ["search_console_priorities"] : []),
    ...(hasResearchRoundFeedback && hasSearchConsoleFeedback ? ["search_console_feedback"] : []),
    ...(hasConstraintDiffRefinements && hasSearchRefinementSuggestions ? ["search_refinement_suggestions"] : []),
    ...(hasConstraintDiffCandidateFeedback && hasCandidateFeedbackSignals ? ["candidate_feedback_signals"] : []),
    ...(hasHeaderBrief && hasSearchConsoleBrief ? ["search_console_brief"] : []),
    ...(hasStatusFunnel && hasCandidateStatusTabs ? ["candidate_status_tabs"] : []),
  ];
  const notes = normalizedLocale === "en"
    ? {
        action_brief: "The control room already carries today's priority action, so the standalone summary is hidden.",
        candidate_feedback_summary: "The control room already carries feedback learning; candidate feedback signals stay in the search console.",
        candidate_evidence_priority: "The project evidence matrix already carries evidence priority, sources, and next actions; the compact priority panel is a fallback when no matrix is available.",
        candidate_comparison: "The project evidence matrix already carries candidate comparison metrics; the generic comparison panel is a fallback when no matrix is available.",
        kpi_strip: "The status funnel already carries candidate totals, status counts, and filtering actions; the KPI strip is a fallback when no funnel is available.",
        latest_round_summary: "The research rounds list already shows the latest round and history; the search console keeps the next-search constraints.",
        search_console_priorities: "The project control room already carries priority actions; search console priorities are a fallback when there is no control room.",
        search_console_feedback: "The research rounds list already shows search feedback summaries; the search console feedback card is a fallback when rounds have no feedback.",
        search_refinement_suggestions: "The next-search constraint diff already shows candidate-status refinements; the detailed suggestions block is a fallback when the diff does not cover them.",
        candidate_feedback_signals: "The next-search constraint diff already shows candidate feedback signals; the detailed block is a fallback when the diff does not cover them.",
        search_console_brief: "The project header already shows and edits the brief; the search console keeps only next-search constraints.",
        candidate_status_tabs: "The status funnel already carries candidate status counts and filtering; list tabs are a fallback when no funnel is available.",
      }
    : {
        action_brief: "控制台已承接今日优先动作，避免重复显示。",
        candidate_feedback_summary: "控制台已承接反馈学习摘要，保留候选人反馈信号在搜索控制台中。",
        candidate_evidence_priority: "项目证据矩阵已包含证据优先级、信源和下一步动作，紧凑优先级面板作为无矩阵时的回退。",
        candidate_comparison: "项目证据矩阵已承接候选人对比指标，通用对比面板作为无矩阵时的回退。",
        kpi_strip: "状态漏斗已承接候选人总数、状态计数和筛选动作，KPI 条作为无漏斗时的回退。",
        latest_round_summary: "研究轮次列表已展示最新轮次和历史记录，搜索控制台只保留下一轮搜索约束。",
        search_console_priorities: "项目控制台已承接优先动作，搜索控制台优先级作为无控制台时的回退。",
        search_console_feedback: "研究轮次列表已展示搜索反馈摘要，搜索控制台反馈卡作为无轮次反馈时的回退。",
        search_refinement_suggestions: "下一轮搜索约束 diff 已展示候选人状态优化，详情建议块作为无 diff 覆盖时的回退。",
        candidate_feedback_signals: "下一轮搜索约束 diff 已展示候选人反馈信号，详情块作为无 diff 覆盖时的回退。",
        search_console_brief: "项目头部已展示并可编辑 brief，搜索控制台只保留下一轮搜索约束。",
        candidate_status_tabs: "状态漏斗已承接候选人状态计数和筛选，列表分段控件作为无漏斗时的回退。",
      };
  const candidateEvidenceSection = hasProjectEvidenceMatrix ? "candidate_evidence_matrix" : "candidate_evidence";
  const summarySections = hasStatusFunnel ? ["search_console", "status_funnel"] : ["search_console", "kpi_strip", "status_funnel"];
  return {
    locale: normalizedLocale,
    primary: hasControlRoom ? ["header", "control_room"] : ["header", "action_brief"],
    secondary: [
      ...summarySections,
      ...(hasCandidates ? ["candidate_decision_queue", candidateEvidenceSection, "candidate_list"] : ["empty_candidates"]),
      "research_rounds",
    ],
    hidden,
    notes,
  };
}
