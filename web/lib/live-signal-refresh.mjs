import { createHash } from "node:crypto";
import { normalizeCandidateLiveSignal } from "./candidate-live-signals.mjs";

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function validIso(value) {
  const clean = cleanString(value);
  const date = clean ? new Date(clean) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function strictIso(value) {
  const clean = cleanString(value);
  if (!clean) return "";
  const date = new Date(clean);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function safeTarget(item = {}) {
  return {
    id: cleanString(item.candidate_id || item.id),
    candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
  };
}

function safeFailedItem(item = {}) {
  return {
    id: cleanString(item.candidate_id || item.id),
    candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
    error: providerSafeError(item.error || item.reason),
  };
}

function providerSafeError(value) {
  const clean = cleanString(value);
  if (!clean) return "live_signal_refresh_failed";
  return clean
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, "$1redacted@")
    .replace(/\bauthorization\s*[:=]\s*(bearer|basic)\s+[^,\s]*/gi, "Authorization: $1 redacted")
    .replace(/\b(bearer|basic)\s+[^,\s]+/gi, "$1 redacted")
    .replace(/(access_token|refresh_token|secret|api[_-]?key)\s*=?\s*[^,\s]*/gi, "$1=redacted")
    .replace(/\b(debug|internal|stack|trace)\b[\s\S]*/gi, "")
    .slice(0, 120)
    .trim() || "live_signal_refresh_failed";
}

function normalizeLiveSignal(signal = {}) {
  const type = cleanString(signal.type || signal.signal_type);
  const summary = cleanString(signal.summary || signal.reason || signal.detail);
  if (!type && !summary) return null;
  return {
    type: type || "candidate_activity",
    source: cleanString(signal.source || signal.provider) || "external_provider",
    confidence: cleanString(signal.confidence) || "medium",
    freshness: cleanString(signal.freshness) || "fresh",
    observed_at: strictIso(signal.observed_at || signal.at || signal.created_at),
    expires_at: strictIso(signal.expires_at),
    summary,
    url: cleanString(signal.url || signal.href),
  };
}

function normalizeProviderRefreshedItem(item = {}) {
  const signals = Array.isArray(item.live_signals) ? item.live_signals : item.signals;
  const liveSignals = (Array.isArray(signals) ? signals : [])
    .map(normalizeLiveSignal)
    .filter(Boolean)
    .slice(0, 20);
  return {
    candidate_id: cleanString(item.candidate_id || item.id),
    candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
    provider: cleanString(item.provider) || "external_live_signal_provider",
    signal_count: nonNegativeInteger(item.signal_count || liveSignals.length),
    live_signals: liveSignals,
  };
}

function candidateGraphMergeKeyIndex(candidateGraph = {}) {
  const index = new Map();
  const candidates = Array.isArray(candidateGraph?.candidates) ? candidateGraph.candidates : [];
  for (const candidate of candidates.filter(isRecord)) {
    const mergeKeys = (Array.isArray(candidate.merge_keys) ? candidate.merge_keys : [])
      .map(cleanString)
      .filter(Boolean);
    const candidateMergeKey = mergeKeys[0];
    if (!candidateMergeKey) continue;
    const record = {
      candidate_id: cleanString(candidate.candidate_id || candidate.id),
      candidate_merge_key: candidateMergeKey,
    };
    for (const key of [record.candidate_id, ...mergeKeys]) {
      if (key) index.set(key.toLowerCase(), record);
    }
  }
  return index;
}

function contentHashForLiveSignal(signal = {}) {
  return createHash("sha256")
    .update(JSON.stringify({
      provider: cleanString(signal.provider),
      type: cleanString(signal.type),
      source_url: cleanString(signal.source_url),
      summary: cleanString(signal.summary),
    }))
    .digest("hex");
}

function refreshFailure(item = {}, error = "live_signal_refresh_failed") {
  return {
    candidate_id: cleanString(item.candidate_id || item.id),
    candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
    error: providerSafeError(error),
  };
}

// Provider IDs are only locators. Persisted records always use a merge key already
// present in the project CandidateGraph, so a provider cannot create a new identity.
export function buildLiveSignalPersistenceRows({
  userId = "",
  projectId = "",
  candidateGraph = {},
  refreshed = [],
} = {}) {
  const mergeKeyIndex = candidateGraphMergeKeyIndex(candidateGraph);
  const rows = [];
  const failed = [];
  let skipped = 0;

  for (const sourceItem of Array.isArray(refreshed) ? refreshed.filter(isRecord) : []) {
    const item = normalizeProviderRefreshedItem(sourceItem);
    const candidate = mergeKeyIndex.get(cleanString(item.candidate_id).toLowerCase());
    if (!candidate) {
      failed.push(refreshFailure(item, "candidate_not_found"));
      continue;
    }

    let validSignals = 0;
    let invalidSignals = 0;
    for (const signal of item.live_signals) {
      const provisional = normalizeCandidateLiveSignal({
        user_id: userId,
        project_id: projectId,
        candidate_merge_key: candidate.candidate_merge_key,
        provider: item.provider,
        type: signal.type,
        source_url: signal.url,
        summary: signal.summary,
        confidence: signal.confidence,
        observed_at: signal.observed_at,
        expires_at: signal.expires_at,
        content_hash: "pending",
      });
      if (!provisional) {
        invalidSignals += 1;
        skipped += 1;
        continue;
      }
      const normalized = normalizeCandidateLiveSignal({
        ...provisional,
        content_hash: contentHashForLiveSignal(provisional),
      });
      if (!normalized) {
        invalidSignals += 1;
        skipped += 1;
        continue;
      }
      rows.push(normalized);
      validSignals += 1;
    }
    if (invalidSignals > 0 || validSignals === 0) {
      failed.push(refreshFailure(item, "invalid_live_signal"));
    }
  }

  return { rows, failed, skipped };
}

export function buildPersistedLiveSignalRefreshResult(signals = []) {
  const rows = [];
  for (const value of Array.isArray(signals) ? signals : []) {
    if (!isRecord(value)) continue;
    const normalized = normalizeCandidateLiveSignal(value);
    const id = cleanString(value.id);
    if (!normalized || !id) continue;
    rows.push({ id, ...normalized });
  }
  const uniqueRows = new Map();
  for (const row of rows) uniqueRows.set(row.id, row);
  const persisted = [...uniqueRows.values()];
  return {
    refreshed: new Set(persisted.map((row) => row.candidate_merge_key)).size,
    persisted_signal_count: persisted.length,
    signal_ids: persisted.map((row) => row.id),
    signal_hashes: persisted.map((row) => row.content_hash),
  };
}

function providerInput(input) {
  if (Array.isArray(input)) return { targets: input };
  return isRecord(input) ? input : {};
}

function providerPayload(input = {}) {
  const source = providerInput(input);
  const targets = (Array.isArray(source.targets) ? source.targets : [])
    .filter(isRecord)
    .map((target) => {
      const row = {
        candidate_id: cleanString(target.candidate_id || target.id),
        candidate_name: cleanString(target.candidate_name || target.name) || "Candidate",
      };
      for (const key of ["status", "refresh_reason", "last_signal_at"]) {
        const value = cleanString(target[key]);
        if (value) row[key] = value;
      }
      for (const key of ["stale_count", "expired_count"]) {
        const value = nonNegativeInteger(target[key]);
        if (value > 0) row[key] = value;
      }
      if (Array.isArray(target.signal_types)) {
        const types = target.signal_types.map(cleanString).filter(Boolean).slice(0, 8);
        if (types.length) row.signal_types = types;
      }
      return row;
    });
  return {
    user_id: cleanString(source.userId || source.user_id),
    project: isRecord(source.project) ? {
      id: cleanString(source.project.id),
      name: cleanString(source.project.name),
      brief: cleanString(source.project.brief),
    } : {},
    targets,
  };
}

export function selectLiveSignalRefreshProjects(projects = [], { limit = 10 } = {}) {
  return (Array.isArray(projects) ? projects : [])
    .filter(isRecord)
    .filter((project) => cleanString(project.status) !== "paused" && cleanString(project.status) !== "closed")
    .filter((project) => nonNegativeInteger(project.role_agent_workspace?.signal_refresh?.due_count) > 0)
    .slice(0, Math.max(1, Math.min(100, Math.floor(Number(limit)))));
}

export function buildLiveSignalRefreshEvent({
  runId = "",
  targets = [],
  persistedSignals = [],
  failed = [],
  at = new Date().toISOString(),
} = {}) {
  const persisted = buildPersistedLiveSignalRefreshResult(persistedSignals);
  const failedItems = (Array.isArray(failed) ? failed : []).filter(isRecord).map(safeFailedItem);
  return {
    event_type: "next_action_execution",
    action_type: "refresh_live_signals",
    action_status: persisted.refreshed > 0 || failedItems.length === 0 ? "succeeded" : "failed",
    run_id: cleanString(runId),
    workflow_step: "refresh_live_signals",
    detail: `${persisted.refreshed} live signals refreshed, ${failedItems.length} failed.`,
    targets: (Array.isArray(targets) ? targets : []).filter(isRecord).map(safeTarget),
    result: {
      provider_ready: true,
      ...persisted,
      failed: failedItems.length,
    },
    failed_items: failedItems,
    retryable: failedItems.length > 0,
    at: validIso(at),
  };
}

export function buildLiveSignalRefreshBlockedEvent({
  runId = "",
  targets = [],
  error = "provider_not_configured",
  at = new Date().toISOString(),
} = {}) {
  const safeError = providerSafeError(error);
  const safeTargets = (Array.isArray(targets) ? targets : []).filter(isRecord).map(safeTarget);
  return {
    event_type: "next_action_execution",
    action_type: "refresh_live_signals",
    action_status: "blocked",
    run_id: cleanString(runId),
    workflow_step: "refresh_live_signals",
    guardrail: "Connect a live signal provider or scheduled refresh job.",
    detail: safeError,
    targets: safeTargets,
    result: { provider_ready: false, refreshed: 0, failed: safeTargets.length },
    failed_items: safeTargets.map((target) => ({ ...target, error: safeError })),
    retryable: true,
    at: validIso(at),
  };
}

export function buildLiveSignalRefreshSummary(results = []) {
  const rows = (Array.isArray(results) ? results : []).filter(isRecord);
  const errors = rows
    .filter((row) => cleanString(row.error))
    .map((row) => ({
      project_id: cleanString(row.project_id),
      error: providerSafeError(row.error),
    }));
  const blocked = rows.filter((row) => cleanString(row.status) === "blocked").length;
  const failed = rows.reduce((sum, row) => sum + nonNegativeInteger(row.failed), 0);
  return {
    checked: rows.length,
    refreshed: rows.reduce((sum, row) => sum + nonNegativeInteger(row.refreshed), 0),
    failed,
    blocked,
    ok: failed === 0 && blocked === 0,
    errors,
  };
}

export async function refreshLiveSignalsWithProvider({ targets = [], provider } = {}) {
  if (!provider || typeof provider.refresh !== "function") {
    return {
      refreshed: [],
      failed: (Array.isArray(targets) ? targets : []).filter(isRecord).map((target) => ({
        ...target,
        error: "provider_not_configured",
      })),
      error: "provider_not_configured",
    };
  }
  return provider.refresh(targets);
}

export function createInternalLiveSignalProvider({ now = new Date().toISOString() } = {}) {
  return {
    async refresh(input = {}) {
      const payload = providerPayload(input);
      const observedAt = validIso(now);
      const expiresAt = new Date(Date.parse(observedAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
      const projectName = cleanString(payload.project?.name) || "this role";
      return {
        synthetic: true,
        refreshed: payload.targets.map((target) => ({
          candidate_id: target.candidate_id,
          candidate_name: target.candidate_name,
          provider: "internal_live_signal_provider",
          signal_count: 1,
          live_signals: [{
            type: "profile_freshness",
            source: "signalhire_internal",
            confidence: "medium",
            freshness: "fresh",
            observed_at: observedAt,
            expires_at: expiresAt,
            summary: `${target.candidate_name} is queued for ${projectName}; review recent evidence before outreach.`,
            url: "",
          }],
        })),
        failed: [],
      };
    },
  };
}

function aggregateSignalTypes(target = {}) {
  const explicit = Array.isArray(target.signal_types) ? target.signal_types.map(cleanString).filter(Boolean) : [];
  if (explicit.length) return Array.from(new Set(explicit)).slice(0, 5);
  const types = ["profile_freshness"];
  if (nonNegativeInteger(target.stale_count) + nonNegativeInteger(target.expired_count) > 1) {
    types.push("candidate_activity");
  }
  if (cleanString(target.refresh_reason) === "expired_live_signal") {
    types.push("recent_content");
  }
  return types;
}

function aggregateSignalSummary(type, target, projectName) {
  const name = cleanString(target.candidate_name) || "Candidate";
  const status = cleanString(target.status) || "stale";
  if (type === "candidate_activity") {
    return `${name} has refreshed activity signals for ${projectName}; review the latest evidence before outreach.`;
  }
  if (type === "company_hiring") {
    return `${projectName} has active hiring context; use it as a why-now angle for ${name}.`;
  }
  if (type === "tech_stack_change") {
    return `${name} has refreshed technology-stack context relevant to ${projectName}.`;
  }
  if (type === "recent_content") {
    return `${name} has refreshed recent-content context after ${status} live signals.`;
  }
  return `${name} has refreshed profile freshness signals for ${projectName}.`;
}

export function buildSignalhireAggregateLiveSignalProviderRefresh(input = {}, { now = new Date().toISOString() } = {}) {
  const payload = providerPayload(input);
  const observedAt = validIso(now);
  const expiresAt = new Date(Date.parse(observedAt) + 7 * 24 * 60 * 60 * 1000).toISOString();
  const projectName = cleanString(payload.project?.name) || "this role";
  return {
    synthetic: true,
    refreshed: payload.targets.map((target) => {
      const liveSignals = aggregateSignalTypes(target).map((type) => ({
        type,
        source: "signalhire_aggregate",
        confidence: type === "profile_freshness" ? "medium" : "low",
        freshness: "fresh",
        observed_at: observedAt,
        expires_at: expiresAt,
        summary: aggregateSignalSummary(type, target, projectName),
        url: "",
      }));
      return {
        candidate_id: target.candidate_id,
        candidate_name: target.candidate_name,
        provider: "signalhire_aggregate_live_signal_provider",
        signal_count: liveSignals.length,
        live_signals: liveSignals,
      };
    }),
    failed: [],
  };
}

export function createSignalhireAggregateLiveSignalProvider({ now = new Date().toISOString() } = {}) {
  return {
    async refresh(input = {}) {
      return buildSignalhireAggregateLiveSignalProviderRefresh(input, { now });
    },
  };
}

export function createHttpLiveSignalProvider({
  url = "",
  apiKey = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 12000,
} = {}) {
  const endpoint = cleanString(url);
  if (!endpoint) return null;
  return {
    async refresh(input = {}) {
      const payload = providerPayload(input);
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller ? setTimeout(() => controller.abort(), Math.max(1000, Number(timeoutMs) || 12000)) : null;
      try {
        const headers = { "Content-Type": "application/json" };
        if (cleanString(apiKey)) headers.Authorization = `Bearer ${cleanString(apiKey)}`;
        const response = await fetchImpl(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
          ...(controller ? { signal: controller.signal } : {}),
        });
        if (!response?.ok) {
          const text = typeof response?.text === "function" ? await response.text() : "";
          const error = providerSafeError(text || `provider_http_${response?.status || "failed"}`);
          return {
            refreshed: [],
            failed: payload.targets.map((target) => ({ ...target, error })),
            error,
          };
        }
        const data = typeof response.json === "function" ? await response.json() : {};
        const refreshed = (Array.isArray(data?.refreshed) ? data.refreshed : Array.isArray(data?.signals) ? data.signals : [])
          .filter(isRecord)
          .map(normalizeProviderRefreshedItem)
          .filter((item) => item.candidate_id || item.candidate_name);
        const failed = (Array.isArray(data?.failed) ? data.failed : [])
          .filter(isRecord)
          .map((item) => ({
            candidate_id: cleanString(item.candidate_id || item.id),
            candidate_name: cleanString(item.candidate_name || item.name) || "Candidate",
            error: providerSafeError(item.error || item.reason),
          }));
        return { refreshed, failed };
      } catch (error) {
        const safeError = providerSafeError(error instanceof Error ? error.message : String(error));
        return {
          refreshed: [],
          failed: payload.targets.map((target) => ({ ...target, error: safeError })),
          error: safeError,
        };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

// Extensionless cron imports select this pure provider module first. Delegate
// the database-backed refresh only when the server route invokes it.
function liveSignalRefreshService() {
  return import("./live-signal-refresh.ts");
}

export async function refreshDueLiveSignals(...args) {
  return (await liveSignalRefreshService()).refreshDueLiveSignals(...args);
}
