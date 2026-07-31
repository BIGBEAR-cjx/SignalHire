import { buildNextRunAt } from "./search-tasks.mjs";

function nextRunAt(task, now) {
  if (task.frequency === "manual") return null;
  return buildNextRunAt({
    frequency: task.frequency,
    timezone: task.timezone,
    scheduleTime: task.schedule_time,
    now,
  });
}

/**
 * A monitor starts in the database as a linked, nonclaimable pending pair. The
 * second RPC makes both records queued in one transaction, so the worker never
 * observes an unlinked monitor research job.
 */
export async function startMonitorRun(task, deps) {
  if (!task || task.status !== "active" || !(await deps.projectIsActive(task))) {
    return { status: "blocked", reason: "monitor_inactive", enqueued: false };
  }

  const payload = await deps.buildResearchPayload(task);
  const started = await deps.startAtomic({
    task,
    monitorRunId: deps.createRunId(),
    researchRunId: deps.createResearchRunId(),
    payload,
  });

  if (started?.state === "paused") {
    return { status: "paused", reason: started.reason, enqueued: false };
  }
  if (started?.state === "queued" || started?.state === "running") {
    return {
      status: "queued",
      duplicate: true,
      run: started.run,
      jobId: started.researchRunId,
      linked: true,
      enqueued: false,
    };
  }
  if (started?.state !== "pending" || !started.run?.id || !started.researchRunId) {
    return { status: "blocked", reason: "monitor_start_unavailable", enqueued: false };
  }

  const activated = await deps.activateAtomic({
    task,
    monitorRunId: started.run.id,
    researchRunId: started.researchRunId,
    nextRunAt: nextRunAt(task, deps.now?.() ?? new Date()),
  });
  if (activated?.state !== "queued") {
    return { status: "blocked", reason: "pending_recovery", run: started.run, enqueued: false };
  }
  return {
    status: "queued",
    duplicate: started.duplicate === true,
    run: started.run,
    jobId: started.researchRunId,
    linked: true,
    enqueued: true,
  };
}
