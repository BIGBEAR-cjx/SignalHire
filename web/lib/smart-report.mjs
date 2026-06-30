import { buildReferralPathViews } from "./referral-paths.mjs";
import { sourceTypeLabel, sourceTypeTooltip } from "./source-classifier.mjs";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanArray(value, limit = 6) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function candidateRole(candidate) {
  return cleanString(candidate.headline || candidate.current_role || candidate.current_title || candidate.role);
}

function evidenceQuality(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return cleanString(audit.overall_evidence_quality || candidate.evidence_quality || "low").toLowerCase();
}

function primaryRisk(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return cleanArray(audit.risk_flags, 1)[0]
    || cleanArray(audit.identity_risks, 1)[0]
    || cleanArray(audit.unverified_claims, 1)[0]
    || cleanArray(candidate.uncertainties, 1)[0]
    || "";
}

function candidateEvidenceSummary(candidate) {
  return cleanArray(candidate.strongest_signals, 1)[0]
    || cleanString(candidate.summary)
    || candidateRole(candidate)
    || "Review candidate evidence before sharing.";
}

function candidateNextAction(candidate, locale) {
  const quality = evidenceQuality(candidate);
  const risk = primaryRisk(candidate);
  const score = Number(candidate.match_score) || 0;
  if (quality === "low" || risk) {
    return locale === "en"
      ? "Verify evidence before outreach or recommendation."
      : "先补公开证据，再决定是否外联或推荐。";
  }
  if (score >= 75) {
    return locale === "en"
      ? "Review evidence and consider controlled outreach."
      : "复核证据后，可进入受控外联。";
  }
  return locale === "en"
    ? "Keep as a next-round search seed."
    : "保留为下一轮搜索种子。";
}

function sourceMixFrom(result, locale) {
  const graph = isRecord(result.evidence_graph) ? result.evidence_graph : {};
  const telemetry = isRecord(result.agent_execution?.telemetry) ? result.agent_execution.telemetry : {};
  const rows = Array.isArray(graph.source_mix) && graph.source_mix.length ? graph.source_mix : telemetry.source_mix;
  return (Array.isArray(rows) ? rows : []).map((item) => {
    const sourceType = cleanString(item?.source_type || "public_web");
    return {
      source_type: sourceType,
      label: sourceTypeLabel(sourceType, locale),
      count: Number(item?.count) || 0,
      tooltip: sourceTypeTooltip(sourceType, locale),
    };
  }).filter((item) => item.count > 0);
}

function referralSummaryFrom(result, candidates, locale) {
  const networkSeeds = Array.isArray(result.network_seeds) ? result.network_seeds : result.networkSeeds;
  const views = buildReferralPathViews({ candidates, networkSeeds, locale });
  return views.flatMap((view) => view.paths.filter((path) => path.client_safe).slice(0, 2).map((path) => ({
    candidate_name: view.candidate_name,
    path_type: path.path_type,
    shared_context: path.shared_context,
    introducer_label: path.introducer_label,
    confidence: path.confidence,
    intro_snippet: path.intro_snippet,
  }))).slice(0, 6);
}

export function buildSmartReportView(result = {}, { locale = "zh" } = {}) {
  const normalizedLocale = locale === "en" ? "en" : "zh";
  const candidates = Array.isArray(result.candidates) ? result.candidates.filter(isRecord) : [];
  const strongEvidence = candidates.filter((candidate) => evidenceQuality(candidate) === "high");
  const readyForOutreach = candidates.filter((candidate) => evidenceQuality(candidate) === "high" && !primaryRisk(candidate) && (Number(candidate.match_score) || 0) >= 75);
  const lowEvidence = candidates.filter((candidate) => evidenceQuality(candidate) === "low");
  const brief = cleanString(result.search_brief?.original_query)
    || cleanString(result.query)
    || cleanString(result.role)
    || (normalizedLocale === "en" ? "Candidate delivery report" : "候选人交付报告");

  const topCandidates = candidates
    .slice()
    .sort((a, b) => (Number(b.match_score) || 0) - (Number(a.match_score) || 0))
    .slice(0, 5)
    .map((candidate) => ({
      name: cleanString(candidate.name) || (normalizedLocale === "en" ? "Unknown candidate" : "未知候选人"),
      role: candidateRole(candidate),
      match_score: Number(candidate.match_score) || 0,
      evidence_quality: evidenceQuality(candidate),
      evidence_summary: candidateEvidenceSummary(candidate),
      primary_risk: primaryRisk(candidate),
      outreach_status: cleanString(candidate.outreach_status || candidate.status) || (normalizedLocale === "en" ? "Not started" : "尚未开始"),
      next_action: candidateNextAction(candidate, normalizedLocale),
    }));

  const risks = [];
  if (lowEvidence.length > 0) {
    risks.push(normalizedLocale === "en"
      ? `Needs evidence verification: ${lowEvidence.map((candidate) => cleanString(candidate.name)).filter(Boolean).slice(0, 4).join(", ")}`
      : `需要补证据：${lowEvidence.map((candidate) => cleanString(candidate.name)).filter(Boolean).slice(0, 4).join("、")}`);
  }
  for (const candidate of candidates) {
    const risk = primaryRisk(candidate);
    if (risk) risks.push(`${cleanString(candidate.name) || "Candidate"}: ${risk}`);
  }

  const nextActions = [];
  if (readyForOutreach.length > 0) {
    nextActions.push(normalizedLocale === "en"
      ? `Review ${readyForOutreach.length} evidence-backed candidate${readyForOutreach.length === 1 ? "" : "s"} for controlled outreach.`
      : `优先复核 ${readyForOutreach.length} 位证据较完整候选人，并进入受控外联。`);
  }
  if (lowEvidence.length > 0) {
    nextActions.push(normalizedLocale === "en"
      ? "Backfill weak public evidence before recommending profile leads."
      : "先为低证据 profile leads 补公开证据，再进入推荐。");
  }
  nextActions.push(normalizedLocale === "en"
    ? "Share this report with the hiring manager or client for review."
    : "把这份报告发给 hiring manager 或客户进行审阅。");

  return {
    title: normalizedLocale === "en" ? "Smart Report" : "智能交付报告",
    brief_summary: brief,
    metrics: {
      candidates: candidates.length,
      strong_evidence: strongEvidence.length,
      ready_for_outreach: readyForOutreach.length,
      needs_scheduling: candidates.filter((candidate) => cleanString(candidate.outreach_status || candidate.status) === "needs_scheduling").length,
    },
    source_mix: sourceMixFrom(result, normalizedLocale),
    top_candidates: topCandidates,
    referral_summary: referralSummaryFrom(result, candidates, normalizedLocale),
    risks: [...new Set(risks)].slice(0, 6),
    next_actions: [...new Set(nextActions)].slice(0, 5),
  };
}
