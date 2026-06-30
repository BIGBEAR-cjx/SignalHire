import { createHash } from "node:crypto";
import { classifySourceType } from "./source-classifier.mjs";

const SOURCE_TYPES = new Set(["github", "paper", "company_page", "personal_site", "people_api", "linkedin_seed", "public_web", "internal_resume", "manual_upload"]);
const SOURCE_MIX_ORDER = ["github", "paper", "company_page", "personal_site", "people_api", "public_web", "linkedin_seed", "internal_resume", "manual_upload"];
const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const EVIDENCE_QUALITY = new Set(["high", "medium", "low"]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanLower(value) {
  return cleanString(value).toLowerCase();
}

function cleanKey(value) {
  return cleanLower(value)
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/[^a-z0-9\u4e00-\u9fff/._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 160);
}

function sourceTypeOf(source) {
  const sourceType = classifySourceType(source);
  return SOURCE_TYPES.has(sourceType) ? sourceType : "public_web";
}

function confidenceOf(value) {
  const confidence = cleanLower(value);
  return CONFIDENCE_LEVELS.has(confidence) ? confidence : "low";
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function normalizeLinkedInUrl(value) {
  const key = cleanKey(value);
  const match = key.match(/linkedin\.com\/in\/[^/?#]+/);
  return match?.[0] ?? "";
}

function normalizeComparableUrl(value) {
  return normalizeLinkedInUrl(value) || cleanKey(value);
}

function normalizeStringArray(value, limit = 5) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean).slice(0, limit) : [];
}

function contactEmails(candidate) {
  const profile = isRecord(candidate.contact_profile) ? candidate.contact_profile : {};
  const emails = Array.isArray(profile.emails) ? profile.emails : [];
  return emails.map((email) => cleanString(isRecord(email) ? email.value : email)).filter(Boolean);
}

function contactPhones(candidate) {
  const profile = isRecord(candidate.contact_profile) ? candidate.contact_profile : {};
  const phones = Array.isArray(profile.phones) ? profile.phones : [];
  return phones.map((phone) => cleanString(isRecord(phone) ? phone.value : phone)).filter(Boolean);
}

function hasContact(candidate) {
  return contactEmails(candidate).length > 0 || contactPhones(candidate).length > 0;
}

function candidateLinkedInUrl(candidate) {
  const links = isRecord(candidate.links) ? candidate.links : {};
  return cleanString(links.linkedin || candidate.linkedin_url);
}

function candidateWebsite(candidate) {
  const links = isRecord(candidate.links) ? candidate.links : {};
  return cleanString(links.website || links.other || candidate.website_url || candidate.personal_url);
}

export function normalizeSourceLead(value = {}) {
  const source = isRecord(value) ? value : {};
  return {
    source_type: sourceTypeOf(source),
    provider: cleanString(source.provider),
    source_url: cleanString(source.source_url),
    captured_at: cleanString(source.captured_at),
    confidence: confidenceOf(source.confidence),
    extracted_fields: isRecord(source.extracted_fields) ? source.extracted_fields : {},
  };
}

export function buildCandidateMergeKeys(candidate = {}) {
  const source = isRecord(candidate) ? candidate : {};
  const keys = [];
  const linkedin = normalizeLinkedInUrl(candidateLinkedInUrl(source));
  if (linkedin) keys.push(`linkedin:${linkedin}`);
  for (const email of contactEmails(source)) keys.push(`email_sha256:${sha256(email.toLowerCase())}`);
  const website = cleanKey(candidateWebsite(source));
  if (website) keys.push(`url:${website}`);
  const name = cleanKey(source.name);
  const company = cleanKey(source.current_company);
  if (name && company) keys.push(`person:${name}:${company}`);
  return [...new Set(keys)];
}

function sourceLeadsFromCandidate(candidate) {
  const explicitNodes = Array.isArray(candidate.source_nodes) ? candidate.source_nodes.map(normalizeSourceLead) : [];
  const nodes = [...explicitNodes];
  const linkedin = candidateLinkedInUrl(candidate);
  if (linkedin) {
    nodes.push(normalizeSourceLead({ source_type: "linkedin_seed", source_url: linkedin, confidence: "medium" }));
  }
  const claims = Array.isArray(candidate.claims) ? candidate.claims : [];
  for (const claim of claims) {
    const evidence = Array.isArray(claim?.evidence) ? claim.evidence : [];
    for (const item of evidence) {
      if (item?.url) {
        nodes.push(normalizeSourceLead({
          source_type: item.source_type || "public_web",
          source_url: item.url,
          confidence: item.confidence || "high",
          extracted_fields: { source_type: cleanString(item.source_type) },
        }));
      }
    }
  }
  return nodes;
}

function candidateComparableUrls(candidate) {
  const urls = new Set();
  const linkedin = normalizeComparableUrl(candidateLinkedInUrl(candidate));
  if (linkedin) urls.add(linkedin);
  const website = normalizeComparableUrl(candidateWebsite(candidate));
  if (website) urls.add(website);
  for (const node of sourceLeadsFromCandidate(candidate)) {
    const url = normalizeComparableUrl(node.source_url);
    if (url) urls.add(url);
  }
  return urls;
}

function attachMatchingSourceLeads(candidate, sourceLeads) {
  const candidateUrls = candidateComparableUrls(candidate);
  return sourceLeads.filter((lead) => {
    const url = normalizeComparableUrl(lead.source_url);
    return url && candidateUrls.has(url);
  });
}

function sourceNodeKey(node) {
  return [
    node.source_type,
    node.provider,
    normalizeComparableUrl(node.source_url),
    node.confidence,
    JSON.stringify(node.extracted_fields),
  ].join("|");
}

function dedupeSourceNodes(nodes) {
  const seen = new Set();
  const deduped = [];
  for (const node of nodes.map(normalizeSourceLead)) {
    const key = sourceNodeKey(node);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(node);
  }
  return deduped;
}

function evidenceQuality(candidate) {
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  const quality = cleanLower(audit.overall_evidence_quality);
  return EVIDENCE_QUALITY.has(quality) ? quality : "low";
}

function evidenceSummary(candidate) {
  const claims = Array.isArray(candidate.claims) ? candidate.claims : [];
  const audit = isRecord(candidate.evidence_audit) ? candidate.evidence_audit : {};
  return {
    quality: evidenceQuality(candidate),
    claim_count: claims.length,
    verified_claim_count: claims.filter((claim) => claim?.verdict === "verified").length,
    unverified_claims: normalizeStringArray(audit.unverified_claims, 10),
    contradicted_claims: normalizeStringArray(audit.contradicted_claims, 10),
  };
}

function roleFit(candidate) {
  return {
    score: Math.max(0, Math.min(100, Math.round(Number(candidate.match_score) || 0))),
    must_have_hits: normalizeStringArray(candidate.strongest_signals),
    gaps: normalizeStringArray(candidate.uncertainties),
    risks: normalizeStringArray(candidate.evidence_audit?.contradicted_claims),
  };
}

function readiness(candidate, sourceNodes) {
  const sourceTypes = new Set(sourceNodes.map((node) => node.source_type));
  const summary = evidenceSummary(candidate);
  const fit = roleFit(candidate);
  if (
    summary.quality === "high" &&
    sourceTypes.size >= 2 &&
    fit.score >= 75 &&
    summary.contradicted_claims.length === 0 &&
    summary.unverified_claims.length === 0
  ) {
    return "ready_for_outreach";
  }
  if (summary.quality === "low" || sourceTypes.size <= 1) return "needs_verification";
  return "sourced";
}

function graphCandidateFrom(candidate, sourceLeads) {
  const source = isRecord(candidate) ? candidate : {};
  const sourceNodes = dedupeSourceNodes([
    ...sourceLeadsFromCandidate(source),
    ...attachMatchingSourceLeads(source, sourceLeads),
  ]);
  const mergeKeys = buildCandidateMergeKeys(source);
  return {
    candidate_id: mergeKeys[0] || "",
    canonical_name: cleanString(source.name),
    current_title: cleanString(source.current_role || source.headline || source.current_title),
    current_company: cleanString(source.current_company),
    locations: cleanString(source.location) ? [cleanString(source.location)] : [],
    source_nodes: sourceNodes,
    merge_keys: mergeKeys,
    evidence_summary: evidenceSummary(source),
    contact_profile: isRecord(source.contact_profile) ? source.contact_profile : null,
    role_fit: roleFit(source),
    readiness: readiness(source, sourceNodes),
    raw_candidate: source,
  };
}

function betterText(current, incoming) {
  return current || incoming;
}

function bestEvidence(current, incoming) {
  const rank = { high: 3, medium: 2, low: 1 };
  return rank[incoming.quality] > rank[current.quality] ? incoming : current;
}

function bestReadiness(current, incoming) {
  const rank = { ready_for_outreach: 3, sourced: 2, needs_verification: 1 };
  return rank[incoming] > rank[current] ? incoming : current;
}

function mergeGraphCandidates(current, incoming) {
  return {
    ...current,
    canonical_name: betterText(current.canonical_name, incoming.canonical_name),
    current_title: betterText(current.current_title, incoming.current_title),
    current_company: betterText(current.current_company, incoming.current_company),
    locations: [...new Set([...current.locations, ...incoming.locations])],
    source_nodes: dedupeSourceNodes([...current.source_nodes, ...incoming.source_nodes]),
    merge_keys: [...new Set([...current.merge_keys, ...incoming.merge_keys])],
    evidence_summary: bestEvidence(current.evidence_summary, incoming.evidence_summary),
    contact_profile: current.contact_profile || incoming.contact_profile,
    role_fit: incoming.role_fit.score > current.role_fit.score ? incoming.role_fit : current.role_fit,
    readiness: bestReadiness(current.readiness, incoming.readiness),
  };
}

function sourceMix(candidates) {
  const counts = new Map();
  for (const candidate of candidates) {
    const candidateTypes = new Set(candidate.source_nodes.map((node) => node.source_type));
    for (const sourceType of candidateTypes) counts.set(sourceType, (counts.get(sourceType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => {
      const leftIndex = SOURCE_MIX_ORDER.indexOf(left);
      const rightIndex = SOURCE_MIX_ORDER.indexOf(right);
      return (leftIndex === -1 ? SOURCE_MIX_ORDER.length : leftIndex) - (rightIndex === -1 ? SOURCE_MIX_ORDER.length : rightIndex);
    })
    .map(([source_type, count]) => ({ source_type, count }));
}

export function buildCandidateGraph(input = {}) {
  const source = isRecord(input) ? input : {};
  const sourceLeads = (Array.isArray(source.sourceLeads) ? source.sourceLeads : []).map(normalizeSourceLead);
  const itemsById = new Map();
  const idByMergeKey = new Map();
  let fallbackId = 0;

  for (const candidate of Array.isArray(source.candidates) ? source.candidates : []) {
    const item = graphCandidateFrom(candidate, sourceLeads);
    const existingId = item.merge_keys.map((key) => idByMergeKey.get(key)).find(Boolean);
    const id = existingId || item.merge_keys[0] || `candidate:${fallbackId++}`;
    const current = itemsById.get(id);
    const merged = current ? mergeGraphCandidates(current, item) : { ...item, candidate_id: id };
    itemsById.set(id, merged);
    for (const key of merged.merge_keys) idByMergeKey.set(key, id);
  }

  const candidates = [...itemsById.values()];
  const readyCount = candidates.filter((candidate) => candidate.readiness === "ready_for_outreach").length;
  const needsVerificationCount = candidates.filter((candidate) => candidate.readiness === "needs_verification").length;
  const contactableCount = candidates.filter((candidate) => hasContact(candidate.raw_candidate)).length;
  const mix = sourceMix(candidates);
  return {
    summary: {
      candidate_count: candidates.length,
      ready_for_outreach_count: readyCount,
      needs_verification_count: needsVerificationCount,
      interview_ready_count: 0,
      source_count: mix.length,
      contactable_count: contactableCount,
      contact_coverage_percent: candidates.length ? Math.round((contactableCount / candidates.length) * 100) : 0,
    },
    source_mix: mix,
    candidates,
  };
}
