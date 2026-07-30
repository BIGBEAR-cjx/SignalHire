const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function validHttpsUrl(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  try {
    const url = new URL(clean);
    return url.protocol === "https:" && url.hostname ? clean : "";
  } catch {
    return "";
  }
}

function confidenceOf(value) {
  const confidence = cleanString(value).toLowerCase();
  return CONFIDENCE_LEVELS.has(confidence) ? confidence : "low";
}

export function normalizeCandidateLiveSignal(value = {}) {
  const userId = cleanString(value.user_id || value.userId);
  const projectId = cleanString(value.project_id || value.projectId);
  const candidateMergeKey = cleanString(value.candidate_merge_key || value.candidateMergeKey);
  const provider = cleanString(value.provider);
  const sourceUrl = validHttpsUrl(value.source_url || value.sourceUrl);
  const summary = cleanString(value.summary);
  const observedAt = validIso(value.observed_at || value.observedAt);
  const expiresAt = validIso(value.expires_at || value.expiresAt);
  const contentHash = cleanString(value.content_hash || value.contentHash);

  if (!userId || !projectId || !candidateMergeKey || !provider || !sourceUrl || !summary || !observedAt || !expiresAt || !contentHash) {
    return null;
  }
  if (Date.parse(expiresAt) <= Date.parse(observedAt)) return null;

  return {
    user_id: userId,
    project_id: projectId,
    candidate_merge_key: candidateMergeKey,
    provider,
    type: cleanString(value.type || value.signal_type) || "candidate_activity",
    source_url: sourceUrl,
    summary,
    confidence: confidenceOf(value.confidence),
    observed_at: observedAt,
    expires_at: expiresAt,
    content_hash: contentHash,
  };
}

export function liveSignalKey(value = {}) {
  const signal = normalizeCandidateLiveSignal(value);
  if (!signal) return "";
  return [
    signal.provider,
    signal.candidate_merge_key,
    signal.source_url,
    signal.content_hash,
  ].join(":");
}

export function buildCandidateLiveSignalUpsertRows(signals = []) {
  const rowsByKey = new Map();
  for (const value of Array.isArray(signals) ? signals : []) {
    const signal = normalizeCandidateLiveSignal(value);
    if (!signal) continue;
    rowsByKey.set(liveSignalKey(signal), signal);
  }
  return [...rowsByKey.values()];
}

export function isCandidateLiveSignalActive(value = {}, now = new Date()) {
  const expiresAt = validIso(value.expires_at || value.expiresAt);
  return Boolean(expiresAt && Date.parse(expiresAt) > new Date(now).getTime());
}
