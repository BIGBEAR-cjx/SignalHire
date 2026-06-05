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
