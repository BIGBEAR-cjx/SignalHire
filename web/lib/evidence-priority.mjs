import {
  buildCandidateComparisonRows,
  buildCandidateEvidenceAudit,
  normalizeTalentSearchResult,
} from "./talent-profile.mjs";
import { t as translate } from "./i18n.mjs";

const PRIORITIES = ["ready_to_review", "needs_backfill", "risk_review"];
const PRIORITY_SORT = {
  risk_review: 0,
  needs_backfill: 1,
  ready_to_review: 2,
};
const ACTIVE_STATUSES = ["contacted", "interviewing", "hired"];
const STATUS_SORT = {
  rejected: 0,
  new: 1,
  contacted: 2,
  interviewing: 3,
  hired: 4,
};

function normalizeLocale(locale) {
  return locale === "en" ? "en" : "zh";
}

function msg(locale, key, params) {
  return translate(normalizeLocale(locale), key, params);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePriority(value) {
  return PRIORITIES.includes(value) ? value : "needs_backfill";
}

function normalizeStatus(value) {
  const status = cleanString(value);
  return ["new", "contacted", "interviewing", "hired", "rejected"].includes(status) ? status : "new";
}

function statusLabel(status, locale) {
  return msg(locale, `shortlist.status.${normalizeStatus(status)}`);
}

function decisionHint(status, priority, locale) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedStatus = normalizeStatus(status);
  const copy = {
    zh: {
      rejected: "保留为负向样本，避免下一轮重复推荐。",
      active: "已进入推进中，优先补备注、外联或安排面试。",
      risk_review: "先复核冲突证据和身份风险，再决定是否外联。",
      needs_backfill: "先补齐公开来源，再决定是否推进。",
      ready_to_review: "证据基础较完整，可以进入人工审阅。",
    },
    en: {
      rejected: "Keep as a negative signal so the next round avoids repeated recommendations.",
      active: "Already in progress. Prioritize notes, outreach, or interview scheduling.",
      risk_review: "Review conflicting evidence and identity risk before outreach.",
      needs_backfill: "Backfill public sources before deciding whether to proceed.",
      ready_to_review: "Evidence is strong enough for human review.",
    },
  }[normalizedLocale];
  if (normalizedStatus === "rejected") return copy.rejected;
  if (ACTIVE_STATUSES.includes(normalizedStatus)) return copy.active;
  return copy[normalizePriority(priority)] || copy.needs_backfill;
}

function resultWithCandidate(result, candidate, candidateIndex = 0) {
  const normalized = normalizeTalentSearchResult(result);
  const graphCandidate = normalized.evidence_graph.candidates[candidateIndex];
  return {
    ...normalized,
    evidence_graph: {
      ...normalized.evidence_graph,
      candidates: graphCandidate ? [graphCandidate] : [],
    },
    candidates: [candidate],
  };
}

function classifyPriority({ row, audit }) {
  const riskCount = audit.contradicted_count + audit.identity_risks.length + audit.risk_flags.length;
  if (riskCount > 0) return "risk_review";
  const hasCoverageGaps = Boolean(cleanString(row.coverage_gaps));
  const weakSingleSourceClaims = audit.single_source_claims.length > 0 && (audit.independent_sources < 3 || row.evidence_quality !== "high");
  const needsBackfill =
    row.evidence_quality === "low" ||
    audit.independent_sources < 2 ||
    audit.unverified_count > 0 ||
    weakSingleSourceClaims ||
    hasCoverageGaps;
  const ready =
    row.match_score >= 75 &&
    row.evidence_quality === "high" &&
    audit.independent_sources >= 2 &&
    !needsBackfill;
  return ready ? "ready_to_review" : "needs_backfill";
}

function backfillReasons({ row, audit, locale }) {
  const reasons = [];
  if (row.evidence_quality === "low") reasons.push(msg(locale, "evidencePriority.reason.lowQuality"));
  if (audit.independent_sources < 2) reasons.push(msg(locale, "evidencePriority.reason.thinSources"));
  if (audit.unverified_count > 0) reasons.push(msg(locale, "evidencePriority.reason.unverified", { count: audit.unverified_count }));
  if (audit.single_source_claims.length > 0) reasons.push(msg(locale, "evidencePriority.reason.singleSource"));
  if (cleanString(row.coverage_gaps)) reasons.push(msg(locale, "evidencePriority.reason.coverageGaps", { gaps: row.coverage_gaps }));
  if (row.match_score < 75) reasons.push(msg(locale, "evidencePriority.reason.lowMatch"));
  return reasons.length ? reasons : [msg(locale, "evidencePriority.reason.default")];
}

function priorityText({ priority, row, audit, locale }) {
  if (priority === "risk_review") {
    return {
      priority_reason: msg(locale, "evidencePriority.risk.reason"),
      recommended_action: msg(locale, "evidencePriority.risk.action"),
    };
  }
  if (priority === "ready_to_review") {
    return {
      priority_reason: msg(locale, "evidencePriority.ready.reason", { matchScore: row.match_score, independentSources: audit.independent_sources }),
      recommended_action: msg(locale, "evidencePriority.ready.action"),
    };
  }
  return {
    priority_reason: msg(locale, "evidencePriority.needs.reason", { reasons: backfillReasons({ row, audit, locale }).join(locale === "en" ? ", " : "，") }),
    recommended_action: msg(locale, "evidencePriority.needs.action"),
  };
}

function matrixActionLabel(priority, locale) {
  const normalizedLocale = normalizeLocale(locale);
  const copy = {
    zh: {
      risk_review: "复核风险",
      needs_backfill: "补搜证据",
      ready_to_review: "打开候选人",
    },
    en: {
      risk_review: "Review risk",
      needs_backfill: "Backfill evidence",
      ready_to_review: "Open candidate",
    },
  }[normalizedLocale];
  return copy[normalizePriority(priority)] || copy.needs_backfill;
}

function matrixBackfillInput(candidate, priority) {
  if (normalizePriority(priority) !== "needs_backfill") return "";
  const role = [candidate?.current_role, candidate?.current_company].map(cleanString).filter(Boolean).join(" / ")
    || cleanString(candidate?.headline)
    || "role unknown";
  const directions = Array.isArray(candidate?.ai_directions) ? candidate.ai_directions.map(cleanString).filter(Boolean).join(", ") : "";
  const audit = candidate?.evidence_audit || {};
  const gaps = [
    ...(Array.isArray(audit?.unverified_claims) ? audit.unverified_claims : []),
    ...(Array.isArray(audit?.single_source_claims) ? audit.single_source_claims : []),
    ...(Array.isArray(candidate?.claims) ? candidate.claims.filter((claim) => claim?.verdict === "unverified").map((claim) => claim?.claim) : []),
  ].map(cleanString).filter(Boolean);
  return [
    "Candidate evidence backfill search for SignalHire.",
    `Candidate: ${cleanString(candidate?.name) || "Unknown candidate"}`,
    `Role/context: ${role}`,
    `AI directions: ${directions || "not specified"}`,
    `Current evidence quality: ${cleanString(audit?.overall_evidence_quality) || "unknown"}`,
    `Evidence gaps: ${gaps.length ? Array.from(new Set(gaps)).slice(0, 6).join("; ") : "overall evidence is weak or insufficiently cross-validated"}`,
    "Search goal: find concrete public sources that confirm, contradict, or update this candidate's fit.",
    "Prioritize independent URLs across research, code, company/work history, public writing, talks, and profile sources.",
  ].join("\n");
}

function matrixRowAction(candidate, priority, locale) {
  const normalizedPriority = normalizePriority(priority);
  return {
    key: normalizedPriority === "risk_review" ? "review_risk" : normalizedPriority === "needs_backfill" ? "backfill_evidence" : "open_candidate",
    label: matrixActionLabel(normalizedPriority, locale),
    search_input: matrixBackfillInput(candidate, normalizedPriority),
  };
}

export function buildEvidencePriorityItem({ candidate, result, locale, candidateIndex = 0 } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const safeIndex = Number.isInteger(candidateIndex) && candidateIndex >= 0 ? candidateIndex : 0;
  const normalizedCandidate = normalizeTalentSearchResult({ candidates: [candidate] }).candidates[0];
  const normalizedResult = normalizeTalentSearchResult(result);
  const selected = normalizedResult.candidates[safeIndex] || normalizedCandidate;
  const scopedResult = resultWithCandidate(normalizedResult, selected, safeIndex);
  const row = buildCandidateComparisonRows(scopedResult)[0];
  const audit = buildCandidateEvidenceAudit({ result: scopedResult, candidate: selected });
  const priority = classifyPriority({ row, audit });
  const text = priorityText({ priority, row, audit, locale: normalizedLocale });
  const riskCount = audit.contradicted_count + audit.identity_risks.length + audit.risk_flags.length;

  return {
    candidate_index: safeIndex,
    name: row.name,
    role: row.role,
    match_score: row.match_score,
    evidence_quality: row.evidence_quality,
    independent_sources: audit.independent_sources,
    verified_count: audit.verified_count,
    unverified_count: audit.unverified_count,
    contradicted_count: audit.contradicted_count,
    risk_count: riskCount,
    priority,
    priority_label: msg(normalizedLocale, `evidencePriority.${priority}.label`),
    priority_reason: text.priority_reason,
    recommended_action: text.recommended_action,
  };
}

export function buildEvidencePriorityView({ result, candidates, locale } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const normalizedResult = normalizeTalentSearchResult(result);
  const sourceCandidates = Array.isArray(candidates)
    ? normalizeTalentSearchResult({ candidates }).candidates
    : normalizedResult.candidates;
  const items = sourceCandidates
    .map((candidate, index) => buildEvidencePriorityItem({ candidate, result: normalizedResult, locale: normalizedLocale, candidateIndex: index }))
    .sort((a, b) => {
      const priorityDelta = PRIORITY_SORT[normalizePriority(a.priority)] - PRIORITY_SORT[normalizePriority(b.priority)];
      if (priorityDelta !== 0) return priorityDelta;
      if (b.match_score !== a.match_score) return b.match_score - a.match_score;
      return a.name.localeCompare(b.name);
    });
  const summary = {
    ready_to_review: 0,
    needs_backfill: 0,
    risk_review: 0,
  };
  for (const item of items) {
    summary[normalizePriority(item.priority)] += 1;
  }
  return {
    summary,
    items,
    empty: items.length === 0,
  };
}

/**
 * @param {{ items?: unknown[]; locale?: string }} input
 */
export function buildProjectEvidenceMatrix({ items = [], locale } = {}) {
  const normalizedLocale = normalizeLocale(locale);
  const sourceItems = Array.isArray(items) ? items.filter(Boolean) : [];
  const candidates = sourceItems.map((item) => item?.candidate).filter(Boolean);
  const result = normalizeTalentSearchResult({ candidates });
  const rows = sourceItems.map((item, index) => {
    const status = normalizeStatus(item?.status);
    const candidate = result.candidates[index];
    const priority = buildEvidencePriorityItem({ candidate, result, locale: normalizedLocale, candidateIndex: index });
    return {
      id: cleanString(item?.id) || String(index),
      candidate_index: index,
      name: priority.name,
      role: priority.role,
      status,
      status_label: statusLabel(status, normalizedLocale),
      match_score: priority.match_score,
      evidence_quality: priority.evidence_quality,
      independent_sources: priority.independent_sources,
      verified_count: priority.verified_count,
      unverified_count: priority.unverified_count,
      contradicted_count: priority.contradicted_count,
      risk_count: priority.risk_count,
      priority: priority.priority,
      priority_label: priority.priority_label,
      priority_reason: priority.priority_reason,
      recommended_action: priority.recommended_action,
      decision_hint: decisionHint(status, priority.priority, normalizedLocale),
      action: matrixRowAction(candidate, priority.priority, normalizedLocale),
    };
  }).sort((a, b) => {
    const priorityDelta = PRIORITY_SORT[normalizePriority(a.priority)] - PRIORITY_SORT[normalizePriority(b.priority)];
    if (priorityDelta !== 0) return priorityDelta;
    const statusDelta = (STATUS_SORT[a.status] ?? 1) - (STATUS_SORT[b.status] ?? 1);
    if (statusDelta !== 0) return statusDelta;
    if (b.match_score !== a.match_score) return b.match_score - a.match_score;
    return a.name.localeCompare(b.name);
  });

  const summary = {
    total: rows.length,
    active: rows.filter((row) => ACTIVE_STATUSES.includes(row.status)).length,
    rejected: rows.filter((row) => row.status === "rejected").length,
    ready_to_review: 0,
    needs_backfill: 0,
    risk_review: 0,
  };
  for (const row of rows) summary[normalizePriority(row.priority)] += 1;

  return {
    title: msg(normalizedLocale, "projects.evidenceMatrix.title"),
    description: msg(normalizedLocale, "projects.evidenceMatrix.desc"),
    summary,
    rows,
    empty: rows.length === 0,
  };
}
