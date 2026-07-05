const ACTION_TYPES = new Set([
  "run_sourcing",
  "review_preview_leads",
  "resolve_contacts",
  "approve_or_send_outreach",
  "retry_failed_outreach",
  "follow_up",
  "review_interested_candidates",
  "refresh_live_signals",
]);
const SETTINGS_ACTION_TYPES = new Set(["agent_status", "approval_mode", "capacity_goal", "client_delivery_visibility", "client_delivery_access"]);
const REPORT_ACTION_TYPES = new Set(["shareable_client_delivery_loop"]);
const MANAGER_FEEDBACK_ACTION_TYPES = new Set(["client_delivery_feedback"]);
const ACTION_STATUSES = new Set(["started", "succeeded", "failed", "blocked"]);

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
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

function normalizeClicks(value) {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key]) => ACTION_TYPES.has(key))
      .map(([key, count]) => [key, nonNegativeInteger(count)]),
  );
}

function normalizeRuns(value) {
  const source = isRecord(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, counts]) => ACTION_TYPES.has(key) && isRecord(counts))
      .map(([key, counts]) => [
        key,
        Object.fromEntries(
          Object.entries(counts)
            .filter(([status]) => ACTION_STATUSES.has(status))
            .map(([status, count]) => [status, nonNegativeInteger(count)]),
        ),
      ]),
  );
}

function normalizeEvents(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((event) => ({
      event_type: cleanString(event.event_type),
      action_type: cleanString(event.action_type),
      action_status: cleanString(event.action_status),
      detail: cleanString(event.detail),
      at: validIso(event.at),
    })).filter((event) => event.event_type)
    : [];
}

function normalizeExecutionTargets(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((target) => ({
      id: cleanString(target.id),
      candidate_name: cleanString(target.candidate_name || target.name),
    })).filter((target) => target.id || target.candidate_name).slice(0, 50)
    : [];
}

function normalizeExecutionResult(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, resultValue]) => cleanString(key) && ["string", "number", "boolean"].includes(typeof resultValue))
      .map(([key, resultValue]) => [cleanString(key), resultValue]),
  );
}

function normalizeExecutionFailures(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((item) => ({
      id: cleanString(item.id),
      candidate_name: cleanString(item.candidate_name || item.name),
      error: cleanString(item.error || item.reason),
    })).filter((item) => item.id || item.candidate_name || item.error).slice(0, 50)
    : [];
}

function normalizeExecutionLog(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((entry) => {
      const actionType = cleanString(entry.action_type);
      const status = cleanString(entry.status || entry.action_status);
      return {
        action_type: ACTION_TYPES.has(actionType) ? actionType : "",
        status: ACTION_STATUSES.has(status) ? status : "",
        detail: cleanString(entry.detail).slice(0, 160),
        targets: normalizeExecutionTargets(entry.targets),
        result: normalizeExecutionResult(entry.result),
        failed_items: normalizeExecutionFailures(entry.failed_items),
        retryable: Boolean(entry.retryable),
        at: validIso(entry.at),
      };
    }).filter((entry) => entry.action_type && entry.status).slice(0, 20)
    : [];
}

function normalizeRoleAgentRuns(value) {
  return Array.isArray(value)
    ? value.filter(isRecord).map((entry) => {
      const actionType = cleanString(entry.action_type);
      const status = cleanString(entry.status || entry.action_status);
      return {
        run_id: cleanString(entry.run_id),
        action_type: ACTION_TYPES.has(actionType) ? actionType : "",
        workflow_step: cleanString(entry.workflow_step),
        status: ACTION_STATUSES.has(status) ? status : "",
        detail: cleanString(entry.detail).slice(0, 160),
        targets: normalizeExecutionTargets(entry.targets),
        result: normalizeExecutionResult(entry.result),
        failed_items: normalizeExecutionFailures(entry.failed_items),
        retryable: Boolean(entry.retryable),
        guardrail: cleanString(entry.guardrail),
        started_at: cleanString(entry.started_at),
        finished_at: cleanString(entry.finished_at),
        updated_at: validIso(entry.updated_at),
      };
    }).filter((entry) => entry.run_id && entry.action_type && entry.status).slice(0, 20)
    : [];
}

function upsertRoleAgentRun(runs, event, at) {
  const actionType = cleanString(event.action_type);
  const status = cleanString(event.action_status);
  const runId = cleanString(event.run_id);
  if (!runId || !ACTION_TYPES.has(actionType) || !ACTION_STATUSES.has(status)) return runs;
  const existing = runs.find((entry) => entry.run_id === runId);
  const failedItems = normalizeExecutionFailures(event.failed_items);
  const terminal = ["succeeded", "failed", "blocked"].includes(status);
  const nextRun = {
    run_id: runId,
    action_type: actionType,
    workflow_step: cleanString(event.workflow_step) || existing?.workflow_step || "",
    status,
    detail: cleanString(event.detail).slice(0, 160) || existing?.detail || "",
    targets: normalizeExecutionTargets(event.targets).length ? normalizeExecutionTargets(event.targets) : existing?.targets || [],
    result: Object.keys(normalizeExecutionResult(event.result)).length ? normalizeExecutionResult(event.result) : existing?.result || {},
    failed_items: failedItems.length ? failedItems : existing?.failed_items || [],
    retryable: Boolean(event.retryable) || failedItems.length > 0 || status === "failed" || Boolean(existing?.retryable),
    guardrail: cleanString(event.guardrail) || existing?.guardrail || "",
    started_at: existing?.started_at || (status === "started" ? at : ""),
    finished_at: terminal ? at : existing?.finished_at || "",
    updated_at: at,
  };
  return [
    nextRun,
    ...runs.filter((entry) => entry.run_id !== runId),
  ].slice(0, 20);
}

export function buildRoleAgentMetricsSummary(current = {}, event = {}) {
  const source = isRecord(current) ? current : {};
  const eventType = cleanString(event.event_type);
  const actionType = cleanString(event.action_type);
  const actionStatus = cleanString(event.action_status);
  const detail = cleanString(event.detail).slice(0, 160);
  const next = {
    panel_views: nonNegativeInteger(source.panel_views),
    settings_updates: nonNegativeInteger(source.settings_updates),
    next_action_clicks: normalizeClicks(source.next_action_clicks),
    next_action_runs: normalizeRuns(source.next_action_runs),
    client_report_views: nonNegativeInteger(source.client_report_views),
    manager_feedback_count: nonNegativeInteger(source.manager_feedback_count),
    last_event_at: cleanString(source.last_event_at),
    recent_events: normalizeEvents(source.recent_events).slice(0, 20),
    execution_log: normalizeExecutionLog(source.execution_log),
    role_agent_runs: normalizeRoleAgentRuns(source.role_agent_runs),
  };

  if (eventType === "panel_view") {
    next.panel_views += 1;
  } else if (eventType === "next_action_click" && ACTION_TYPES.has(actionType)) {
    next.next_action_clicks[actionType] = nonNegativeInteger(next.next_action_clicks[actionType]) + 1;
  } else if (eventType === "next_action_execution" && ACTION_TYPES.has(actionType) && ACTION_STATUSES.has(actionStatus)) {
    next.next_action_runs[actionType] = isRecord(next.next_action_runs[actionType])
      ? next.next_action_runs[actionType]
      : {};
    next.next_action_runs[actionType][actionStatus] = nonNegativeInteger(next.next_action_runs[actionType][actionStatus]) + 1;
  } else if (eventType === "settings_update" && SETTINGS_ACTION_TYPES.has(actionType)) {
    next.settings_updates += 1;
  } else if (eventType === "client_report_view" && REPORT_ACTION_TYPES.has(actionType)) {
    next.client_report_views += 1;
  } else if (eventType === "manager_feedback" && MANAGER_FEEDBACK_ACTION_TYPES.has(actionType)) {
    next.manager_feedback_count += 1;
  } else {
    return next;
  }

  const at = validIso(event.at);
  next.last_event_at = at;
  next.recent_events = [
    {
      event_type: eventType,
      action_type: ACTION_TYPES.has(actionType) || SETTINGS_ACTION_TYPES.has(actionType) || REPORT_ACTION_TYPES.has(actionType) || MANAGER_FEEDBACK_ACTION_TYPES.has(actionType) ? actionType : "",
      action_status: ACTION_STATUSES.has(actionStatus) ? actionStatus : "",
      detail,
      at,
    },
    ...next.recent_events,
  ].slice(0, 20);
  if (eventType === "next_action_execution" && ACTION_TYPES.has(actionType) && ["succeeded", "failed", "blocked"].includes(actionStatus)) {
    const failedItems = normalizeExecutionFailures(event.failed_items);
    next.execution_log = [
      {
        action_type: actionType,
        status: actionStatus,
        detail,
        targets: normalizeExecutionTargets(event.targets),
        result: normalizeExecutionResult(event.result),
        failed_items: failedItems,
        retryable: Boolean(event.retryable) || failedItems.length > 0 || actionStatus === "failed",
        at,
      },
      ...next.execution_log,
    ].slice(0, 20);
  }
  if (eventType === "next_action_execution") {
    next.role_agent_runs = upsertRoleAgentRun(next.role_agent_runs, event, at);
  }
  return next;
}
