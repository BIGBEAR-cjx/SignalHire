export const SEARCH_TASK_FREQUENCIES = ["manual", "daily", "weekly"];
export const SEARCH_TASK_STATUSES = ["active", "paused"];

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function addDays(now, days) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
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

export function normalizeSearchTaskInput(input = {}) {
  const brief = cleanString(input.brief);
  const name = cleanString(input.name) || brief.slice(0, 80) || "Talent monitor";
  const frequency = SEARCH_TASK_FREQUENCIES.includes(input.frequency) ? input.frequency : "manual";
  const status = SEARCH_TASK_STATUSES.includes(input.status) ? input.status : "active";
  return { name, brief, frequency, status };
}

export function buildNextRunAt({ frequency, now = new Date() }) {
  if (frequency === "daily") return addDays(now, 1);
  if (frequency === "weekly") return addDays(now, 7);
  return null;
}

export function buildSearchTaskRunLabel({ taskName, sequence = 1 }) {
  const safeName = cleanString(taskName) || "Talent monitor";
  return `${safeName} · Monitor run ${Math.max(1, Number(sequence) || 1)}`;
}

export function classifyTaskCandidates({ result, knownProfiles = [] }) {
  const knownByKey = new Map();
  const knownByBareName = new Map();
  for (const profile of knownProfiles) {
    const nameKey = cleanString(profile?.name).toLowerCase();
    const key = candidateKey(profile);
    if (key) knownByKey.set(key, profile);
    if (nameKey && !cleanString(profile?.current_company) && !cleanString(profile?.current_role)) {
      knownByBareName.set(nameKey, profile);
    }
  }
  const items = (Array.isArray(result?.candidates) ? result.candidates : []).map((candidate, index) => {
    const candidateLookupKey = candidateKey(candidate);
    const candidateName = cleanString(candidate?.name).toLowerCase();
    const candidateHasIdentityContext = Boolean(cleanString(candidate?.current_company) || cleanString(candidate?.current_role));
    const known = knownByKey.get(candidateLookupKey) ?? (candidateHasIdentityContext ? null : knownByBareName.get(candidateName)) ?? null;
    const urls = evidenceUrls(candidate);
    const knownUrls = new Set(Array.isArray(known?.evidence_urls) ? known.evidence_urls : []);
    const evidenceUpdated = Boolean(known && urls.some((url) => !knownUrls.has(url)));
    return {
      candidate_index: index,
      cache_key: candidateKey(candidate),
      name: cleanString(candidate?.name) || "Unknown candidate",
      discovery_state: known ? "seen_before" : "new_candidate",
      evidence_updated: evidenceUpdated,
      evidence_urls: urls,
    };
  });
  return {
    summary: {
      new_candidates: items.filter((item) => item.discovery_state === "new_candidate").length,
      seen_candidates: items.filter((item) => item.discovery_state === "seen_before").length,
      updated_candidates: items.filter((item) => item.evidence_updated).length,
    },
    items,
  };
}

export function summarizeTaskRuns(runs = []) {
  const ordered = [...runs].sort((a, b) => String(b?.updated_at ?? "").localeCompare(String(a?.updated_at ?? "")));
  const last = ordered[0] ?? null;
  const doneRuns = ordered.filter((run) => run?.status === "done");
  const totals = doneRuns.reduce((acc, run) => {
    const summary = run?.result?.task_discovery?.summary ?? {};
    acc.new_candidates += Number(summary.new_candidates ?? 0) || 0;
    acc.updated_candidates += Number(summary.updated_candidates ?? 0) || 0;
    return acc;
  }, { new_candidates: 0, updated_candidates: 0 });
  return {
    last_status: last?.status ?? "idle",
    last_run_at: last?.updated_at ?? null,
    ...totals,
  };
}
