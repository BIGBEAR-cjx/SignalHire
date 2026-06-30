function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sourceTypes(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  if (Array.isArray(source.source_types)) return source.source_types.map(String);
  if (Array.isArray(source.source_nodes)) {
    return source.source_nodes
      .map((node) => (isRecord(node) ? String(node.source_type ?? "") : ""))
      .filter(Boolean);
  }
  return [];
}

function isProfileLeadCandidate(candidate) {
  return sourceTypes(candidate).includes("people_api") || String(isRecord(candidate) ? candidate.provider ?? "" : "") === "openjobs_mira";
}

function isVerifiedCandidate(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const quality = String(source.evidence_quality || source.evidence_summary?.quality || source.evidence_audit?.overall_evidence_quality || "").toLowerCase();
  const readiness = String(source.readiness || "").toLowerCase();
  return quality && quality !== "low" && readiness === "ready_for_outreach";
}

function copy(locale) {
  if (locale === "zh") {
    return {
      title: "Profile Lead Layer / 资料线索层",
      explanation: "OpenJobs/Mira 提供 profile leads only：它能快速扩展候选线索，但不是已验证推荐，也不承诺资料准确率。",
      next_step: "下一步是 evidence verification / 公开证据核验：补齐公开证据包和联系方式来源后，再推荐或外联。",
    };
  }
  return {
    title: "Profile Lead Layer",
    explanation: "OpenJobs/Mira provides profile leads only: fast candidate expansion without treating provider profiles as verified recommendations or accuracy guarantees.",
    next_step: "Next step: evidence verification. Build a public evidence packet and contact provenance before recommendation or outreach.",
  };
}

export function buildProfileLeadLayerView({ leadPreview = {}, candidateGraph = {}, env = process.env, locale = "en" } = {}) {
  const previewItems = Array.isArray(leadPreview?.items) ? leadPreview.items : [];
  const graphCandidates = Array.isArray(candidateGraph?.candidates) ? candidateGraph.candidates : [];
  const sourceMix = Array.isArray(candidateGraph?.source_mix) ? candidateGraph.source_mix : [];
  const previewProfileLeads = previewItems.filter((item) => isRecord(item) && item.source_type === "people_api").length;
  const graphProfileLeads = sourceMix
    .filter((source) => isRecord(source) && source.source_type === "people_api")
    .reduce((sum, source) => sum + Number(source.count ?? 0), 0);
  const verifiedCandidateCount = graphCandidates.filter(isVerifiedCandidate).length;
  const leadCount = previewProfileLeads + graphProfileLeads;
  const needsEvidenceCount = Math.max(0, leadCount - verifiedCandidateCount);

  return {
    provider: "openjobs_mira",
    enabled: Boolean(env.MIRA_KEY),
    lead_count: leadCount,
    verified_candidate_count: verifiedCandidateCount,
    needs_evidence_count: needsEvidenceCount,
    copy: copy(locale === "zh" ? "zh" : "en"),
  };
}
