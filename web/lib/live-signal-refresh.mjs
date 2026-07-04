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
  return clean.replace(/(access_token|refresh_token|secret|api[_-]?key)=?[^,\s]*/gi, "$1=redacted").slice(0, 120);
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
