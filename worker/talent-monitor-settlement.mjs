const BATCH_SIZES = new Set([5, 10, 20]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function candidateKey(candidate) {
  const name = cleanString(candidate?.name).toLowerCase();
  const company = cleanString(candidate?.current_company).toLowerCase();
  const role = cleanString(candidate?.current_role).toLowerCase();
  return [name, company, role].filter(Boolean).join(":") || name;
}

function evidenceUrls(candidate) {
  const urls = new Set();
  for (const claim of Array.isArray(candidate?.claims) ? candidate.claims : []) {
    for (const evidence of Array.isArray(claim?.evidence) ? claim.evidence : []) {
      const url = cleanString(evidence?.url);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

export function monitorBatchSize(configSnapshot) {
  const size = Number(configSnapshot?.candidate_batch_size);
  if (!BATCH_SIZES.has(size)) {
    throw new Error("Monitor run snapshot has an invalid candidate batch size");
  }
  return size;
}

export function limitMonitorCandidates(candidates, candidateBatchSize) {
  if (!BATCH_SIZES.has(Number(candidateBatchSize))) {
    throw new Error("Monitor candidate batch size is invalid");
  }
  return (Array.isArray(candidates) ? candidates : []).slice(0, Number(candidateBatchSize));
}

function knownProfilesByKey(knownProfiles) {
  const byKey = new Map();
  const byBareName = new Map();
  for (const profile of Array.isArray(knownProfiles) ? knownProfiles : []) {
    const key = candidateKey(profile);
    const name = cleanString(profile?.name).toLowerCase();
    if (key) byKey.set(key, profile);
    if (name && !cleanString(profile?.current_company) && !cleanString(profile?.current_role)) {
      byBareName.set(name, profile);
    }
  }
  return { byKey, byBareName };
}

export function classifyMonitorCandidates({ candidates, knownProfiles = [], candidateBatchSize }) {
  const original = Array.isArray(candidates) ? candidates : [];
  const capped = limitMonitorCandidates(original, candidateBatchSize);
  const known = knownProfilesByKey(knownProfiles);
  const items = capped.map((candidate, index) => {
    const key = candidateKey(candidate);
    const name = cleanString(candidate?.name).toLowerCase();
    const hasIdentityContext = Boolean(cleanString(candidate?.current_company) || cleanString(candidate?.current_role));
    const profile = known.byKey.get(key) ?? (hasIdentityContext ? null : known.byBareName.get(name)) ?? null;
    const urls = evidenceUrls(candidate);
    const knownUrls = new Set(Array.isArray(profile?.evidence_urls) ? profile.evidence_urls : []);
    return {
      candidate_index: index,
      cache_key: key,
      name: cleanString(candidate?.name) || "Unknown candidate",
      discovery_state: profile ? "seen_before" : "new_candidate",
      evidence_updated: Boolean(profile && urls.some((url) => !knownUrls.has(url))),
      evidence_urls: urls,
    };
  });
  return {
    candidates: capped,
    summary: {
      requested_count: Number(candidateBatchSize),
      returned_count: capped.length,
      new_candidates: items.filter((item) => item.discovery_state === "new_candidate").length,
      seen_candidates: items.filter((item) => item.discovery_state === "seen_before" && !item.evidence_updated).length,
      updated_candidates: items.filter((item) => item.evidence_updated).length,
      skipped_candidates: Math.max(0, original.length - capped.length),
    },
    items,
  };
}

export function monitorNotificationPayload({ monitorRunId, configSnapshot, discovery }) {
  if (configSnapshot?.notification_enabled !== true || !monitorRunId) return null;
  const candidates = (Array.isArray(discovery?.items) ? discovery.items : [])
    .filter((item) => item.discovery_state === "new_candidate" || item.evidence_updated === true)
    .map((item) => ({
      candidate_index: item.candidate_index,
      cache_key: item.cache_key,
      name: item.name,
      discovery_state: item.discovery_state,
      evidence_updated: item.evidence_updated,
    }));
  if (candidates.length === 0) return null;
  return {
    type: "talent_monitor_discovery",
    dedupe_key: `monitor-run:${monitorRunId}:discovery`,
    candidates,
  };
}

export function prepareMonitorResult({ result, knownProfiles, configSnapshot, monitorRunId }) {
  const candidateBatchSize = monitorBatchSize(configSnapshot);
  const discovery = classifyMonitorCandidates({
    candidates: result?.candidates,
    knownProfiles,
    candidateBatchSize,
  });
  return {
    ...result,
    candidates: discovery.candidates,
    task_discovery: {
      summary: discovery.summary,
      items: discovery.items,
      notification: monitorNotificationPayload({ monitorRunId, configSnapshot, discovery }),
    },
  };
}
