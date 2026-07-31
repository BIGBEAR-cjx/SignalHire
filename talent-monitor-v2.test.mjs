import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildNextRunAt,
  nextRunAfterPatch,
  normalizeMonitorInput,
  snapshotMonitorConfig,
} from "./web/lib/search-tasks.mjs";
import { startMonitorRun } from "./web/lib/talent-monitor-run.mjs";

test("normalizes monitor configuration to supported values", () => {
  const normalized = normalizeMonitorInput({
    candidate_batch_size: 12,
    timezone: "Asia/Shanghai",
    schedule_time: "09:00",
    monthly_credit_limit: 35,
    notification_enabled: true,
  });

  assert.equal(normalized.candidate_batch_size, 10);
  assert.equal(normalized.timezone, "Asia/Shanghai");
  assert.equal(normalized.schedule_time, "09:00");
  assert.equal(normalized.monthly_credit_limit, 35);
  assert.equal(normalized.notification_enabled, true);
  assert.equal(normalizeMonitorInput({ timezone: "browser-supplied-not-a-timezone" }).timezone, "UTC");
});

test("schedules daily and weekly monitors at their configured local time", () => {
  const now = new Date("2026-07-30T02:00:00.000Z");

  assert.equal(
    buildNextRunAt({ frequency: "daily", timezone: "Asia/Shanghai", scheduleTime: "09:00", now }),
    "2026-07-31T01:00:00.000Z",
  );
  assert.equal(
    buildNextRunAt({ frequency: "weekly", timezone: "Asia/Shanghai", scheduleTime: "09:00", now }),
    "2026-08-06T01:00:00.000Z",
  );
  assert.equal(
    buildNextRunAt({
      frequency: "daily",
      timezone: "America/New_York",
      scheduleTime: "09:00",
      now: new Date("2026-03-07T17:00:00.000Z"),
    }),
    "2026-03-08T13:00:00.000Z",
  );
});

test("keeps the scheduled run unchanged for non-schedule patches", () => {
  const existing = {
    name: "Agent monitor",
    frequency: "daily",
    timezone: "Asia/Shanghai",
    schedule_time: "09:00",
    status: "active",
    next_run_at: "2026-07-31T01:00:00.000Z",
  };

  assert.equal(nextRunAfterPatch(existing, { name: "Renamed" }), existing.next_run_at);
  assert.equal(nextRunAfterPatch(existing, { schedule_time: "10:00" }, new Date("2026-07-30T02:00:00.000Z")), "2026-07-31T02:00:00.000Z");
  assert.equal(nextRunAfterPatch(existing, { status: "paused" }), null);
});

test("takes an immutable snapshot of monitor configuration", () => {
  const snapshot = snapshotMonitorConfig({
    name: "Agent monitor",
    brief: "Find agent engineers",
    frequency: "weekly",
    candidate_batch_size: 20,
    timezone: "Asia/Shanghai",
    schedule_time: "09:00",
    monthly_credit_limit: 60,
    notification_enabled: true,
  });

  assert.deepEqual(snapshot, {
    name: "Agent monitor",
    brief: "Find agent engineers",
    frequency: "weekly",
    candidate_batch_size: 20,
    timezone: "Asia/Shanghai",
    schedule_time: "09:00",
    monthly_credit_limit: 60,
    notification_enabled: true,
  });
});

test("forward migration preserves legacy scheduled monitor cadence", () => {
  const migration = readFileSync("migrations/20260730020000_preserve_legacy_talent_monitor_schedule.sql", "utf8");

  assert.match(migration, /update public\.search_tasks[\s\S]*set schedule_time = to_char\(/i);
  assert.match(migration, /coalesce\(next_run_at, last_run_at, created_at\) at time zone 'UTC'/i);
  assert.match(migration, /where frequency in \('daily', 'weekly'\)/i);
  assert.match(migration, /and timezone = 'UTC'\s*and schedule_time = '09:00'/i);
  assert.doesNotMatch(migration, /set\s+next_run_at\s*=/i);
});

test("legacy schedule migration does not target preconfigured v2 monitor timezones", () => {
  const migration = readFileSync("migrations/20260730020000_preserve_legacy_talent_monitor_schedule.sql", "utf8");

  assert.match(migration, /where frequency in \('daily', 'weekly'\)\s+and timezone = 'UTC'\s+and schedule_time = '09:00'/i);
  assert.doesNotMatch(migration, /timezone = 'Asia\/Shanghai'/i);
});

test("monitor migration scopes constraint-name checks to search_tasks", () => {
  const migration = readFileSync("migrations/20260730000000_talent_monitor_v2.sql", "utf8");

  assert.match(migration, /conrelid = 'public\.search_tasks'::regclass/i);
});

function monitorTask(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    project_id: "33333333-3333-4333-8333-333333333333",
    name: "Agent monitor",
    brief: "Find applied AI engineers",
    status: "active",
    frequency: "daily",
    candidate_batch_size: 10,
    timezone: "UTC",
    schedule_time: "09:00",
    monthly_credit_limit: 20,
    monthly_credit_used: 0,
    monthly_credit_reserved: 0,
    notification_enabled: false,
    ...overrides,
  };
}

function monitorDeps(overrides = {}) {
  const calls = { reserve: [], release: [], create: [], enqueue: [], pause: [], abort: [] };
  return {
    calls,
    projectIsActive: async () => true,
    findActiveRun: async () => null,
    createRunId: () => "44444444-4444-4444-8444-444444444444",
    reserveCredits: async (input) => {
      calls.reserve.push(input);
      return { reservationId: "55555555-5555-4555-8555-555555555555" };
    },
    releaseCredits: async (input) => { calls.release.push(input); },
    createRun: async (input) => {
      calls.create.push(input);
      return { run: { id: input.runId, status: "queued" } };
    },
    enqueue: async (input) => { calls.enqueue.push(input); return "66666666-6666-4666-8666-666666666666"; },
    linkResearchRun: async () => true,
    markQueued: async () => {},
    pauseTask: async (_task, reason) => { calls.pause.push(reason); },
    abortRun: async (input) => { calls.abort.push(input); return true; },
    ...overrides,
  };
}

test("reserves Credits before creating and enqueuing a monitor run", async () => {
  const deps = monitorDeps();
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "queued");
  assert.equal(result.jobId, "66666666-6666-4666-8666-666666666666");
  assert.equal(deps.calls.reserve.length, 1);
  assert.equal(deps.calls.create.length, 1);
  assert.equal(deps.calls.enqueue.length, 1);
  assert.equal(deps.calls.create[0].creditsReserved, 10);
  assert.equal(deps.calls.create[0].configSnapshot.candidate_batch_size, 10);
});

test("pauses without enqueueing when the monthly monitor budget is exhausted", async () => {
  const deps = monitorDeps();
  const result = await startMonitorRun(monitorTask({ monthly_credit_used: 15 }), deps);

  assert.equal(result.status, "paused");
  assert.equal(result.reason, "monthly_credit_limit");
  assert.equal(deps.calls.reserve.length, 0);
  assert.equal(deps.calls.enqueue.length, 0);
  assert.deepEqual(deps.calls.pause, ["monthly_credit_limit"]);
});

test("pauses insufficient Credits without creating or enqueueing a run", async () => {
  const deps = monitorDeps({ reserveCredits: async () => { throw new Error("insufficient available Credits"); } });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "paused");
  assert.equal(result.reason, "insufficient_credits");
  assert.equal(deps.calls.create.length, 0);
  assert.equal(deps.calls.enqueue.length, 0);
  assert.deepEqual(deps.calls.pause, ["insufficient_credits"]);
});

test("returns an existing active run without spending another reservation", async () => {
  const deps = monitorDeps({ findActiveRun: async () => ({ id: "existing-run", status: "running" }) });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "queued");
  assert.equal(result.duplicate, true);
  assert.equal(deps.calls.reserve.length, 0);
  assert.equal(deps.calls.enqueue.length, 0);
});

test("concurrent duplicate creation releases its just-created reservation", async () => {
  const deps = monitorDeps({ createRun: async () => ({ duplicate: true, run: { id: "existing-run", status: "queued" } }) });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.duplicate, true);
  assert.equal(deps.calls.release.length, 1);
  assert.equal(deps.calls.enqueue.length, 0);
});

test("queue failure aborts the task run and releases through the DB cleanup RPC", async () => {
  const deps = monitorDeps({ enqueue: async () => null });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "queue_unavailable");
  assert.equal(deps.calls.abort.length, 1);
  assert.equal(deps.calls.release.length, 0, "abort RPC performs the atomic Credits release");
});

test("monitor run security migration locks owner identity and browser access", () => {
  const migration = readFileSync("migrations/20260731040000_talent_monitor_run_security.sql", "utf8");

  assert.match(migration, /foreign key \(search_task_id, user_id\)[\s\S]*references public\.search_tasks \(id, user_id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.search_task_runs from public/i);
  assert.match(migration, /search_task_runs_one_active_per_task_idx/i);
  assert.match(migration, /perform public\.release_credits\(v_run\.id/i);
});
