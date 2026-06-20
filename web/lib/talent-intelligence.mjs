function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function claims(candidate) {
  return Array.isArray(candidate?.claims) ? candidate.claims : [];
}

function evidenceFor(candidate, sourceTypes) {
  const allowed = new Set(sourceTypes);
  return claims(candidate).flatMap((claim) => (Array.isArray(claim?.evidence) ? claim.evidence : [])
    .filter((evidence) => allowed.has(cleanString(evidence?.source_type)))
    .map((evidence) => ({ claim: cleanString(claim?.claim), url: cleanString(evidence?.url), source_type: cleanString(evidence?.source_type) }))
    .filter((item) => item.url));
}

function section(key, title, sourceTypes, candidate) {
  const evidence = evidenceFor(candidate, sourceTypes);
  return {
    key,
    title,
    evidence_count: evidence.length,
    evidence,
    summary: evidence.length
      ? evidence.slice(0, 2).map((item) => item.claim).filter(Boolean).join(" · ")
      : "No strong public evidence captured yet.",
  };
}

function audit(candidate) {
  const list = claims(candidate);
  return {
    verified_count: list.filter((claim) => claim?.verdict === "verified").length,
    unverified_count: list.filter((claim) => claim?.verdict === "unverified").length,
    contradicted_count: list.filter((claim) => claim?.verdict === "contradicted").length,
    independent_sources: new Set(list.flatMap((claim) => (claim.evidence ?? []).map((e) => cleanString(e.url)).filter(Boolean))).size,
  };
}

export function buildTalentIntelligenceReport({ candidate, locale = "zh" }) {
  const evidenceAudit = candidate?.evidence_audit ?? {};
  const reportAudit = audit(candidate);
  const unverified = reportAudit.unverified_count;
  return {
    locale,
    name: cleanString(candidate?.name) || "Unknown candidate",
    headline: [candidate?.current_role, candidate?.current_company].map(cleanString).filter(Boolean).join(" / ") || cleanString(candidate?.headline),
    match_score: Number(candidate?.match_score ?? 0) || 0,
    evidence_quality: cleanString(evidenceAudit.overall_evidence_quality) || "medium",
    strongest_signals: Array.isArray(candidate?.strongest_signals) ? candidate.strongest_signals.slice(0, 5) : [],
    sections: [
      section("technical", locale === "en" ? "Technical ability" : "技术能力", ["code", "project", "huggingface", "dataset", "benchmark"], candidate),
      section("research", locale === "en" ? "Research ability" : "研究能力", ["paper", "patent", "dataset", "benchmark"], candidate),
      section("influence", locale === "en" ? "Influence" : "影响力", ["talk", "blog", "podcast", "interview", "community"], candidate),
      section("career", locale === "en" ? "Career trajectory" : "职业轨迹", ["profile", "company", "school_official", "lab_profile"], candidate),
    ],
    audit: reportAudit,
    next_actions: [
      cleanString(candidate?.outreach_angle)
        ? (locale === "en" ? `Draft outreach: ${cleanString(candidate.outreach_angle)}` : `起草触达：${cleanString(candidate.outreach_angle)}`)
        : (locale === "en" ? "Draft outreach from the strongest verified signal." : "基于最强已验证信号起草触达。"),
      unverified > 0
        ? (locale === "en" ? "Review evidence gap before outreach." : "触达前先复核证据缺口。")
        : (locale === "en" ? "Move to outreach or hiring-manager review." : "进入触达或用人经理评审。"),
    ],
  };
}

function evidenceUrls(candidate) {
  return new Set(claims(candidate).flatMap((claim) => (claim.evidence ?? []).map((e) => cleanString(e.url)).filter(Boolean)));
}

export function buildRelatedTalentView({ candidate, pool = [], locale = "zh" }) {
  const baseUrls = evidenceUrls(candidate);
  const baseDirections = new Set(Array.isArray(candidate?.ai_directions) ? candidate.ai_directions : []);
  const items = pool.map((person) => {
    const urls = evidenceUrls(person);
    const sharesEvidence = [...urls].some((url) => baseUrls.has(url));
    const sharedDirections = (Array.isArray(person?.ai_directions) ? person.ai_directions : []).filter((direction) => baseDirections.has(direction));
    if (!sharesEvidence && sharedDirections.length === 0) return null;
    if (urls.size === 0) return null;
    const reason = sharesEvidence
      ? (locale === "en" ? "Shares the same code source or public evidence trail." : "共享同一代码来源或公开证据链。")
      : (locale === "en" ? `Same AI direction: ${sharedDirections.join(", ")}.` : `同一 AI 方向：${sharedDirections.join("、")}。`);
    return {
      name: cleanString(person?.name) || "Unknown candidate",
      role: [person?.current_role, person?.current_company].map(cleanString).filter(Boolean).join(" / "),
      relation_reason: reason,
      evidence_urls: [...urls],
    };
  }).filter(Boolean);
  const directions = [...baseDirections].join(", ");
  return {
    items,
    generated_search_brief: `Find candidates similar to ${cleanString(candidate?.name) || "this candidate"}${directions ? ` in ${directions}` : ""}, prioritizing public evidence, code, papers, projects, and career trajectory.`,
  };
}
