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
    error: cleanString(item.error || item.reason) || "live_signal_refresh_failed",
  };
}

function providerSafeError(value) {
  const clean = cleanString(value);
  if (!clean) return "live_signal_refresh_failed";
  return clean
    .replace(/(access_token|refresh_token|secret|api[_-]?key)=?[^,\s]*/gi, "$1=redacted")
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
    observed_at: validIso(signal.observed_at || signal.at || signal.created_at),
    expires_at: cleanString(signal.expires_at) ? validIso(signal.expires_at) : "",
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
  refreshed = [],
  failed = [],
  at = new Date().toISOString(),
} = {}) {
  const refreshedCount = Array.isArray(refreshed) ? refreshed.length : 0;
  const failedItems = (Array.isArray(failed) ? failed : []).filter(isRecord).map(safeFailedItem);
  return {
    event_type: "next_action_execution",
    action_type: "refresh_live_signals",
    action_status: refreshedCount > 0 || failedItems.length === 0 ? "succeeded" : "failed",
    run_id: cleanString(runId),
    workflow_step: "refresh_live_signals",
    detail: `${refreshedCount} live signals refreshed, ${failedItems.length} failed.`,
    targets: (Array.isArray(targets) ? targets : []).filter(isRecord).map(safeTarget),
    result: {
      provider_ready: true,
      refreshed: refreshedCount,
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
