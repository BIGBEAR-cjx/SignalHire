import { snapshotMonitorConfig } from "./search-tasks.mjs";

export const MONITOR_PAUSE_REASONS = {
  insufficientCredits: "insufficient_credits",
  monthlyCreditLimit: "monthly_credit_limit",
  creditsUnavailable: "credits_unavailable",
};

function monthlyBudgetAllows(task, amount) {
  return task.monthly_credit_used + task.monthly_credit_reserved + amount <= task.monthly_credit_limit;
}

function isInsufficientCredits(error, deps) {
  if (typeof deps.isInsufficientCredits === "function") return deps.isInsufficientCredits(error);
  return /insufficient.*credits/i.test(String(error?.message ?? error));
}

async function releaseReservation(deps, runId) {
  try {
    await deps.releaseCredits({ runId, idempotencyKey: `monitor-run:${runId}:release` });
  } catch {
    // The caller only invokes this after a reservation was created. Returning a
    // failure keeps the run out of the queue; the Credits release remains safe
    // to retry with the same idempotency key.
    return false;
  }
  return true;
}

/**
 * The only orchestration path for manual, Role Agent, and scheduled monitors.
 * Storage adapters make the task-row lock/active-run uniqueness authoritative.
 */
export async function startMonitorRun(task, deps) {
  if (!task || task.status !== "active" || !(await deps.projectIsActive(task))) {
    return { status: "blocked", reason: "monitor_inactive", enqueued: false };
  }

  const amount = task.candidate_batch_size;
  if (!monthlyBudgetAllows(task, amount)) {
    await deps.pauseTask(task, MONITOR_PAUSE_REASONS.monthlyCreditLimit);
    return { status: "paused", reason: MONITOR_PAUSE_REASONS.monthlyCreditLimit, enqueued: false };
  }

  const existing = await deps.findActiveRun(task);
  if (existing) return { status: "queued", duplicate: true, run: existing, enqueued: false };

  const runId = deps.createRunId();
  let reserved = false;
  let createdRun = null;
  try {
    const reservation = await deps.reserveCredits({
      userId: task.user_id,
      runId,
      amount,
      idempotencyKey: `monitor-run:${runId}:reserve`,
    });
    reserved = true;
    if (!reservation?.reservationId) throw new Error("Credits reservation was not confirmed");

    const created = await deps.createRun({
      task,
      runId,
      creditReservationId: reservation.reservationId,
      creditsReserved: amount,
      configSnapshot: snapshotMonitorConfig(task),
    });
    if (created?.duplicate) {
      if (!(await releaseReservation(deps, runId))) {
        return { status: "blocked", reason: "cleanup_required", enqueued: false };
      }
      return { status: "queued", duplicate: true, run: created.run, enqueued: false };
    }
    if (created?.paused) {
      if (!(await releaseReservation(deps, runId))) {
        return { status: "blocked", reason: "cleanup_required", enqueued: false };
      }
      return { status: "paused", reason: created.reason, enqueued: false };
    }
    if (!created?.run) throw new Error("Monitor run was not created");
    createdRun = created.run;

    const jobId = await deps.enqueue({ task, run: createdRun });
    if (!jobId) throw new Error("Monitor run was not enqueued");
    const linked = await deps.linkResearchRun({ runId: createdRun.id, researchRunId: jobId }).catch(() => false);
    await deps.markQueued(task).catch(() => undefined);
    return { status: "queued", duplicate: false, run: createdRun, jobId, linked, enqueued: true };
  } catch (error) {
    if (createdRun) {
      const aborted = await deps.abortRun({ runId: createdRun.id, idempotencyKey: `monitor-run:${runId}:release` });
      return { status: "blocked", reason: aborted ? "queue_unavailable" : "cleanup_required", enqueued: false };
    }
    if (reserved) await releaseReservation(deps, runId);
    if (isInsufficientCredits(error, deps)) {
      await deps.pauseTask(task, MONITOR_PAUSE_REASONS.insufficientCredits);
      return { status: "paused", reason: MONITOR_PAUSE_REASONS.insufficientCredits, enqueued: false };
    }
    return { status: "blocked", reason: "credits_unavailable", enqueued: false };
  }
}
