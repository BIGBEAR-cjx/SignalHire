import {
  buildLiveSignalPersistenceRows,
  buildLiveSignalRefreshBlockedEvent,
  buildLiveSignalRefreshEvent,
  buildPersistedLiveSignalRefreshResult,
} from "./live-signal-refresh.mjs";

const SUPPORTED_ACTIONS = new Set(["run_sourcing", "refresh_live_signals", "prepare_outreach"]);

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

function autopilotApprovalTargets(workspace = {}) {
  const runPlanTargets = workspace?.autopilot_path?.run_plan?.targets;
  const workflowSteps = workspace?.autopilot_path?.workflow?.steps;
  const approvalStep = Array.isArray(workflowSteps)
    ? workflowSteps.find((step) => cleanString(step?.type) === "approve_drafts")
    : null;
  const source = Array.isArray(runPlanTargets) && runPlanTargets.length > 0
    ? runPlanTargets
    : Array.isArray(approvalStep?.targets) ? approvalStep.targets : [];
  return safeTargets(source).slice(0, 25);
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
  candidateGraph = {},
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
    const blocked = providerResult.error === "provider_not_configured" || providerResult.synthetic === true;
    if (blocked) {
      const event = buildLiveSignalRefreshBlockedEvent({
        runId: run.run_id,
        targets,
        error: providerResult.synthetic === true ? "provider_not_configured" : providerResult.error,
        at: now.toISOString(),
      });
      await record(deps, run.project_id, run.user_id, event);
      return {
        status: event.action_status,
        result: event.result,
        failed_items: event.failed_items,
        run,
      };
    }

    const persistenceInput = buildLiveSignalPersistenceRows({
      userId,
      projectId: run.project_id,
      candidateGraph,
      refreshed: providerResult.refreshed,
    });
    const persistedSignals = typeof deps.upsertCandidateLiveSignals === "function"
      ? await deps.upsertCandidateLiveSignals(persistenceInput.rows)
      : [];
    const persisted = buildPersistedLiveSignalRefreshResult(persistedSignals);
    const persistedHashes = new Set(persisted.signal_hashes);
    const persistenceFailedByMergeKey = new Map();
    for (const row of persistenceInput.rows) {
      if (!persistedHashes.has(row.content_hash)) {
        persistenceFailedByMergeKey.set(row.candidate_merge_key, {
          candidate_id: row.candidate_merge_key,
          candidate_name: "Candidate",
          error: "live_signal_persistence_failed",
        });
      }
    }
    const event = buildLiveSignalRefreshEvent({
      runId: run.run_id,
      targets,
      persistedSignals,
      failed: [
        ...(Array.isArray(providerResult.failed) ? providerResult.failed : []),
        ...persistenceInput.failed,
        ...persistenceFailedByMergeKey.values(),
      ],
      at: now.toISOString(),
    });
    await record(deps, run.project_id, run.user_id, event);
    return {
      status: event.action_status,
      result: event.result,
      failed_items: event.failed_items,
      run,
    };
  }

  if (run.action_type === "prepare_outreach") {
    const targets = autopilotApprovalTargets(workspace);
    const contactResult = typeof deps.resolveContacts === "function"
      ? await deps.resolveContacts({ userId, projectId: run.project_id, targets })
      : { status: "disabled", summary: { resolved: 0, skipped: 0, failed: 0 }, items: [], error: "contact_resolution_not_configured" };
    const contactSummary = contactResult?.summary || {};
    const sendableIds = new Set((Array.isArray(contactResult?.items) ? contactResult.items : [])
      .filter((item) => item?.can_send !== false)
      .map((item) => cleanString(item?.id || item?.candidate_id))
      .filter(Boolean));
    const approvalTargets = targets.filter((target) => !sendableIds.size || sendableIds.has(target.id));
    const approved = [];
    const failed = [];
    for (const target of approvalTargets) {
      try {
        const updated = typeof deps.approveOutreachDraft === "function"
          ? await deps.approveOutreachDraft({ userId, id: target.id, target, project })
          : null;
        if (updated?.id || cleanString(updated?.status) === "approved") approved.push(target);
        else failed.push({ ...target, error: "approval_failed" });
      } catch (error) {
        failed.push({ ...target, error: error instanceof Error ? error.message : "approval_failed" });
      }
    }
    const result = {
      resolved: Number(contactSummary.resolved ?? 0) || 0,
      skipped: Number(contactSummary.skipped ?? 0) || 0,
      contact_failed: Number(contactSummary.failed ?? 0) || 0,
      approved: approved.length,
      failed: failed.length,
      sent: 0,
    };
    const event = {
      event_type: "next_action_execution",
      action_type: "prepare_outreach",
      action_status: approved.length > 0 || failed.length === 0 ? "succeeded" : "failed",
      run_id: run.run_id,
      workflow_step: "prepare_outreach",
      guardrail: "No emails were sent; first-email send still requires manual confirmation.",
      detail: `${approved.length} ready drafts approved, ${failed.length} failed. No emails were sent.`,
      targets: approved,
      result,
      failed_items: failed,
      retryable: failed.length > 0 || result.contact_failed > 0,
      at: now.toISOString(),
    };
    await record(deps, run.project_id, run.user_id, event);
    return { status: event.action_status, result, failed_items: failed, run };
  }

  return { status: "failed", error: "unsupported_role_agent_action", run };
}
