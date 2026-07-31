const CONFIDENCE_LEVELS = new Set(["high", "medium", "low"]);
const TRACKING_QUERY_PARAM = /^(utm_.+|fbclid|gclid|dclid|msclkid|mc_[ce]id)$/i;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

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
    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) return "";
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAM.test(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return "";
  }
}

function confidenceOf(value) {
  const confidence = cleanString(value).toLowerCase();
  return CONFIDENCE_LEVELS.has(confidence) ? confidence : "low";
}

export function normalizeCandidateLiveSignal(value = {}) {
  if (!isRecord(value)) return null;
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
    rowsByKey.set([signal.user_id, signal.project_id, liveSignalKey(signal)].join(":"), signal);
  }
  return [...rowsByKey.values()];
}

export function isCandidateLiveSignalActive(value = {}, now = new Date()) {
  if (!isRecord(value)) return false;
  const expiresAt = validIso(value.expires_at || value.expiresAt);
  return Boolean(expiresAt && Date.parse(expiresAt) > new Date(now).getTime());
}

// Live-signal providers never create candidate identities. A persisted row is
// visible only when its stored merge key belongs to the already-built graph.
/**
 * @param {{ candidates?: any[], signals?: any[], now?: Date | string }} input
 * @returns {any[]}
 */
export function attachActiveCandidateLiveSignals({ candidates = [], signals = [], now = new Date() } = {}) {
  const activeByMergeKey = new Map();
  for (const value of Array.isArray(signals) ? signals : []) {
    const signal = normalizeCandidateLiveSignal(value);
    if (!signal || !isCandidateLiveSignalActive(signal, now)) continue;
    const key = signal.candidate_merge_key.toLowerCase();
    const rows = activeByMergeKey.get(key) ?? [];
    rows.push(signal);
    activeByMergeKey.set(key, rows);
  }

  return (Array.isArray(candidates) ? candidates : []).map((candidate) => {
    if (!isRecord(candidate)) return candidate;
    const matched = [];
    for (const key of Array.isArray(candidate.merge_keys) ? candidate.merge_keys : []) {
      const rows = activeByMergeKey.get(cleanString(key).toLowerCase()) ?? [];
      for (const signal of rows) {
        if (!matched.some((item) => liveSignalKey(item) === liveSignalKey(signal))) matched.push(signal);
      }
    }
    return matched.length ? { ...candidate, live_signals: matched } : { ...candidate, live_signals: [] };
  });
}

// The persistence layer stays in the typed server module. These bridges make
// extensionless imports resolve to the same implementation at Next runtime
// without adding the server SDK to this pure candidate-view module eagerly.
function candidateLiveSignalStore() {
  return import("./candidate-live-signals.ts");
}

export async function upsertCandidateLiveSignals(signals) {
  return (await candidateLiveSignalStore()).upsertCandidateLiveSignals(signals);
}

export async function listActiveCandidateLiveSignals(input) {
  return (await candidateLiveSignalStore()).listActiveCandidateLiveSignals(input);
}
