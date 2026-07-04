import {
  buildLiveSignalRefreshBlockedEvent,
  buildLiveSignalRefreshEvent,
} from "./live-signal-refresh.mjs";

const SUPPORTED_ACTIONS = new Set(["run_sourcing", "refresh_live_signals"]);

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function validIso(value) {
  const clean = cleanString(value);
  const date = clean ? new Date(clean) : new Date();
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function safeRunSuffix(value) {
  return cleanString(value).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}

function safeTargets(targets = []) {
  return (Array.isArray(targets) ? targets : []).map((target) => ({
    id: cleanString(target?.candidate_id || target?.id),
    candidate_name: cleanString(target?.candidate_name || target?.name) || "Candidate",
  })).filter((target) => target.id || target.candidate_name);
}

export function buildRoleAgentRunRecord({
  projectId = "",
  userId = "",
  actionType = "",
  at = new Date().toISOString(),
} = {}) {
  const action = SUPPORTED_ACTIONS.has(actionType) ? actionType : "";
  const startedAt = validIso(at);
  return {
    run_id: `role-agent-${action || "unsupported"}-${safeRunSuffix(projectId)}-${Date.parse(startedAt) || Date.now()}`,
    user_id: cleanString(userId),
    project_id: cleanString(projectId),
    action_type: action,
    workflow_step: action,
    status: "started",
    started_at: startedAt,
    updated_at: startedAt,
  };
}

function startedEvent(run, detail) {
  return {
    event_type: "next_action_execution",
    action_type: run.action_type,
    action_status: "started",
    run_id: run.run_id,
    workflow_step: run.workflow_step,
    detail,
    at: run.started_at,
  };
}

async function record(deps, projectId, userId, event) {
  if (typeof deps?.recordEvent === "function") {
    await deps.recordEvent(event);
  }
  if (typeof deps?.recordProjectRoleAgentEvent === "function") {
    await deps.recordProjectRoleAgentEvent({ userId, id: projectId, event });
  }
}

export async function runRoleAgentRunCore({
  userId = "",
  project = {},
  actionType = "",
  workspace = {},
  now = new Date(),
  deps = {},
} = {}) {
  const run = buildRoleAgentRunRecord({
    userId,
    projectId: project.id,
    actionType,
    at: now.toISOString(),
  });
  if (!run.action_type) return { status: "failed", error: "unsupported_role_agent_action", run };

  await record(deps, run.project_id, run.user_id, startedEvent(run, `Starting ${run.action_type}.`));

  if (run.action_type === "run_sourcing") {
    const brief = cleanString(project.brief || project.name);
    if (!brief) {
      const event = {
        event_type: "next_action_execution",
        action_type: "run_sourcing",
        action_status: "failed",
        run_id: run.run_id,
        workflow_step: "run_sourcing",
        detail: "missing_role_brief",
        result: { failed: 1 },
        retryable: true,
        at: now.toISOString(),
      };
      await record(deps, run.project_id, run.user_id, event);
      return { status: "failed", error: "missing_role_brief", run };
    }
    const task = await deps.createSearchTask?.({
      userId,
      projectId: run.project_id,
      name: "Role Agent sourcing",
      brief,
      frequency: "manual",
      status: "active",
    });
    if (!task?.id) throw new Error("search_task_create_failed");
    const queued = await deps.runSearchTaskNow?.({ userId, id: task.id });
    if (!queued?.jobId) throw new Error("search_task_run_failed");
    const result = { search_task_id: task.id, job_id: queued.jobId };
    await record(deps, run.project_id, run.user_id, {
      event_type: "next_action_execution",
      action_type: "run_sourcing",
      action_status: "succeeded",
      run_id: run.run_id,
      workflow_step: "run_sourcing",
      detail: "Sourcing job started.",
      targets: [{ id: task.id, candidate_name: cleanString(project.name) || "Role" }],
      result,
      at: now.toISOString(),
    });
    return { status: "succeeded", result, run };
  }

  const targets = Array.isArray(workspace?.signal_refresh?.targets) ? workspace.signal_refresh.targets : [];
  if (run.action_type === "refresh_live_signals") {
    const providerResult = typeof deps.refreshLiveSignals === "function"
      ? await deps.refreshLiveSignals({ userId, project, targets })
      : { refreshed: [], failed: targets.map((target) => ({ ...target, error: "provider_not_configured" })), error: "provider_not_configured" };
    const event = providerResult.error === "provider_not_configured"
      ? buildLiveSignalRefreshBlockedEvent({ runId: run.run_id, targets, error: providerResult.error, at: now.toISOString() })
      : buildLiveSignalRefreshEvent({
        runId: run.run_id,
        targets,
        refreshed: providerResult.refreshed,
        failed: providerResult.failed,
        at: now.toISOString(),
      });
    await record(deps, run.project_id, run.user_id, event);
    return {
      status: event.action_status,
      result: event.result,
      failed_items: safeTargets(event.failed_items),
      run,
    };
  }

  return { status: "failed", error: "unsupported_role_agent_action", run };
}
