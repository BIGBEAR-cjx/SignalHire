const MISSING_EVIDENCE = ["public evidence packet", "contact provenance"];
const DEFAULT_NEXT_STEP = "Verify public evidence packet and contact provenance before recommendation or outreach.";

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanKey(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/+$/, "");
}

function arrayOf(value) {
  return Array.isArray(value) ? value : [];
}

function progressEventRows(run) {
  const progress = isRecord(run?.progress) ? run.progress : {};
  const execution = isRecord(progress.agent_execution) ? progress.agent_execution : {};
  return arrayOf(execution.candidate_submission_events);
}

function resultEventRows(run) {
  const result = isRecord(run?.result) ? run.result : {};
  const execution = isRecord(result.agent_execution) ? result.agent_execution : {};
  return arrayOf(execution.candidate_submission_events);
}

function openEvidenceRows(rows) {
  return arrayOf(rows).map((row) => {
    const source = isRecord(row) ? row : {};
    return {
      id: source.id,
      name: source.title || source.name || source.candidate_name,
      headline: source.snippet,
      company: source.company || source.current_company,
      source_type: source.source_type || source.provider || "open_evidence",
      source_url: source.source_url || source.url,
      match_reason: source.snippet || source.reason,
      confidence: source.confidence || "low",
    };
  });
}

function resultHasVerifiedCandidates(run) {
  const result = isRecord(run?.result) ? run.result : {};
  return arrayOf(result.shortlist).length > 0 || arrayOf(result.candidates).length > 0;
}

function leadKeys(source) {
  const sourceUrl = cleanString(source.source_url || source.url);
  const name = cleanString(source.name || source.candidate_name || source.title);
  const company = cleanString(source.company || source.current_company);
  const urlKey = cleanKey(sourceUrl);
  const nameCompanyKey = cleanKey(`${name}:${company}`);
  return {
    urlKey,
    nameCompanyKey: name ? nameCompanyKey : "",
  };
}

function normalizeLead(row) {
  if (!isRecord(row)) return null;

  const sourceUrl = cleanString(row.source_url || row.url);
  const name = cleanString(row.name || row.candidate_name || row.title);
  const company = cleanString(row.company || row.current_company);
  const { urlKey, nameCompanyKey } = leadKeys(row);
  const id = urlKey || nameCompanyKey;

  if (!id) return null;

  return {
    id,
    label: "unverified lead",
    candidate_name: name || "Unnamed lead",
    headline: cleanString(row.headline || row.current_role || row.role || row.title),
    company,
    source_type: cleanString(row.source_type || row.provider || row.source || "unknown"),
    source_url: sourceUrl,
    possible_match_reason: cleanString(row.match_reason || row.reason || row.summary || row.snippet),
    missing_evidence: MISSING_EVIDENCE,
    next_verification_step: DEFAULT_NEXT_STEP,
    confidence: cleanString(row.confidence || "low"),
    feedback_state: "untouched",
    can_outreach: false,
  };
}

export function buildLeadPreviewView({ run = {}, openEvidenceLeads = [] } = {}) {
  if (resultHasVerifiedCandidates(run)) {
    return { status: "verified_results_available", items: [], feedback_constraints: [] };
  }

  const seen = new Set();
  const items = [];
  const rows = [...progressEventRows(run), ...openEvidenceRows(openEvidenceLeads), ...resultEventRows(run)];

  for (const row of rows) {
    const item = normalizeLead(row);
    if (!item) continue;

    const keys = leadKeys(row);
    if ((keys.urlKey && seen.has(keys.urlKey)) || (keys.nameCompanyKey && seen.has(keys.nameCompanyKey))) {
      continue;
    }

    if (keys.urlKey) seen.add(keys.urlKey);
    if (keys.nameCompanyKey) seen.add(keys.nameCompanyKey);
    items.push(item);
  }

  return {
    status: items.length > 0 ? "preview_available" : "waiting_for_leads",
    items,
    feedback_constraints: [],
  };
}
