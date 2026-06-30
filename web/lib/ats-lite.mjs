import { createHash } from "node:crypto";

export const ATS_LITE_PROVIDER = "greenhouse";

const REVIEWED_STATUSES = new Set(["shortlisted", "outreach_drafted", "contacted", "interviewing", "hired"]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeLinkedInUrl(value) {
  const clean = cleanString(value).toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
  const match = clean.match(/linkedin\.com\/in\/[^/]+/);
  return match?.[0] ?? "";
}

function hashEmail(value) {
  const email = cleanString(value).toLowerCase();
  if (!email) return "";
  return createHash("sha256").update(email).digest("hex");
}

function firstSendableEmail(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  if (typeof source.email === "string" && source.email.includes("@")) return cleanString(source.email).toLowerCase();
  const contactProfile = isRecord(source.contact_profile) ? source.contact_profile : {};
  const emails = Array.isArray(contactProfile.emails) ? contactProfile.emails : [];
  const found = emails.find((email) => {
    if (!isRecord(email)) return false;
    const confidence = String(email.confidence ?? "").toLowerCase();
    const deliverability = String(email.deliverability_status ?? "").toLowerCase();
    return cleanString(email.value).includes("@")
      && ["high", "medium"].includes(confidence)
      && !["invalid", "bounced", "risky"].includes(deliverability);
  });
  return isRecord(found) ? cleanString(found.value).toLowerCase() : "";
}

function linkedinFromCandidate(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const links = isRecord(source.links) ? source.links : {};
  const contactProfile = isRecord(source.contact_profile) ? source.contact_profile : {};
  return normalizeLinkedInUrl(source.linkedin_url || links.linkedin || contactProfile.linkedin_url);
}

function verifiedClaimTexts(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const claims = Array.isArray(source.claims) ? source.claims : [];
  return claims
    .filter((claim) => isRecord(claim) && String(claim.verdict ?? "").toLowerCase() === "verified")
    .map((claim) => cleanString(claim.text || claim.claim || claim.summary))
    .filter(Boolean)
    .slice(0, 3);
}

function sourceMixSummary(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  const nodes = Array.isArray(source.source_nodes) ? source.source_nodes : [];
  const counts = new Map();
  for (const node of nodes) {
    if (!isRecord(node)) continue;
    const type = cleanString(node.source_type || node.type || "source");
    if (!type) continue;
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([type, count]) => `${type} x${count}`).join(", ");
}

function candidateName(candidate) {
  const source = isRecord(candidate) ? candidate : {};
  return cleanString(source.name || source.candidate_name || "Unknown candidate");
}

export function buildAtsLiteProviderStatus(env = process.env) {
  const enabled = Boolean(env.GREENHOUSE_API_KEY);
  return {
    provider: ATS_LITE_PROVIDER,
    enabled,
    reason: enabled ? "GREENHOUSE_API_KEY configured" : "GREENHOUSE_API_KEY missing",
  };
}

export function mockGreenhouseJob(externalJobId = "greenhouse-demo-role") {
  return {
    provider: ATS_LITE_PROVIDER,
    id: cleanString(externalJobId) || "greenhouse-demo-role",
    title: "ML Platform Engineer",
    department: "Engineering",
    location: "San Francisco / Remote",
    description: "Build reliable ML infrastructure, model serving, and evaluation workflows for production AI systems.",
    hiring_team: ["Head of Engineering", "Recruiting Lead"],
  };
}

export function buildAtsJobImportView(raw = {}) {
  const source = isRecord(raw) ? raw : {};
  return {
    provider: ATS_LITE_PROVIDER,
    external_job_id: cleanString(source.external_job_id || source.id || "greenhouse-demo-role"),
    title: cleanString(source.title || "Untitled ATS role"),
    description: cleanString(source.description || source.job_description || ""),
    department: cleanString(source.department || ""),
    location: cleanString(source.location || ""),
    hiring_team: Array.isArray(source.hiring_team) ? source.hiring_team.map(cleanString).filter(Boolean) : [],
  };
}

export function buildAtsProjectDraft(job = {}) {
  const view = buildAtsJobImportView(job);
  const lines = [
    `Department: ${view.department || "Unknown"}`,
    `Location: ${view.location || "Unknown"}`,
    view.hiring_team?.length ? `Hiring team: ${view.hiring_team.join(", ")}` : "",
    "",
    "Job description:",
    view.description,
  ].filter((line) => line !== "");
  return {
    name: view.title,
    brief: lines.join("\n"),
  };
}

export function buildAtsDedupeKeys({ candidate = {}, atsCandidateId = "" } = {}) {
  const email = firstSendableEmail(candidate);
  return {
    ats_candidate_id: cleanString(atsCandidateId),
    email_hash: hashEmail(email),
    linkedin_url: linkedinFromCandidate(candidate),
  };
}

export function buildAtsCandidateExportPayload({
  provider = ATS_LITE_PROVIDER,
  projectId = "",
  candidateId = "",
  status = "",
  candidate = {},
  reportBaseUrl = "",
  atsCandidateId = "",
} = {}) {
  if (!REVIEWED_STATUSES.has(String(status))) {
    return { ok: false, reason: "candidate_not_reviewed" };
  }

  const evidence = verifiedClaimTexts(candidate);
  const mix = sourceMixSummary(candidate);
  if (evidence.length === 0 || !mix) {
    return { ok: false, reason: "candidate_missing_evidence" };
  }

  const base = cleanString(reportBaseUrl).replace(/\/+$/, "");
  const reportUrl = base
    ? `${base}/app/projects/${encodeURIComponent(projectId)}?candidate=${encodeURIComponent(candidateId)}`
    : `/app/projects/${encodeURIComponent(projectId)}?candidate=${encodeURIComponent(candidateId)}`;
  const dedupeKeys = buildAtsDedupeKeys({ candidate, atsCandidateId });
  const payload = {
    provider,
    project_id: cleanString(projectId),
    candidate_id: cleanString(candidateId),
    name: candidateName(candidate),
    email: firstSendableEmail(candidate) || undefined,
    linkedin_url: linkedinFromCandidate(candidate) || undefined,
    evidence_summary: evidence.join(" | "),
    source_mix_summary: mix,
    report_url: reportUrl,
  };
  return { ok: true, payload, dedupe_keys: dedupeKeys };
}
