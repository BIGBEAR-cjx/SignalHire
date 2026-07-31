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
import { buildMonitorView } from "./web/lib/talent-monitor-view.mjs";

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

test("builds a user-safe monitor view with immutable run configuration", () => {
  const view = buildMonitorView({
    id: "monitor-1",
    name: "Agent monitor",
    brief: "Find applied AI engineers",
    frequency: "weekly",
    status: "paused",
    candidate_batch_size: 10,
    timezone: "Asia/Shanghai",
    schedule_time: "09:00",
    monthly_credit_limit: 30,
    monthly_credit_used: 10,
    monthly_credit_reserved: 5,
    notification_enabled: true,
    pause_reason: "monthly_credit_limit",
    last_run_at: "2026-07-30T01:00:00.000Z",
    next_run_at: null,
    runs: [{
      id: "run-1",
      status: "done",
      research_run_id: "research-1",
      requested_count: 10,
      returned_count: 7,
      new_candidates: 4,
      updated_candidates: 2,
      seen_candidates: 1,
      skipped_candidates: 3,
      credits_reserved: 10,
      credits_consumed: 7,
      credits_released: 3,
      outreach_sent: 99,
      candidate_snapshot: { email: "private@example.com" },
      report: { secret: "private" },
      config_snapshot: {
        candidate_batch_size: 10,
        timezone: "Asia/Shanghai",
        schedule_time: "09:00",
      },
    }],
  });

  assert.equal(view.runs[0].config_snapshot.candidate_batch_size, 10);
  assert.equal(view.runs[0].outreach_sent, undefined);
  assert.equal(view.runs[0].candidate_snapshot, undefined);
  assert.equal(view.runs[0].report, undefined);
  assert.deepEqual(view.credits, { limit: 30, used: 10, reserved: 5, available: 15 });
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
  const calls = { payload: [], start: [], activate: [] };
  return {
    calls,
    projectIsActive: async () => true,
    createRunId: () => "44444444-4444-4444-8444-444444444444",
    createResearchRunId: () => "55555555-5555-4555-8555-555555555555",
    buildResearchPayload: async (task) => {
      calls.payload.push(task);
      return { candidateHints: [] };
    },
    startAtomic: async (input) => {
      calls.start.push(input);
      return {
        state: "pending",
        duplicate: false,
        run: { id: input.monitorRunId, status: "pending" },
        researchRunId: input.researchRunId,
      };
    },
    activateAtomic: async (input) => {
      calls.activate.push(input);
      return { state: "queued" };
    },
    ...overrides,
  };
}

test("creates a pending linked pair before its atomic queue activation", async () => {
  const deps = monitorDeps();
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "queued");
  assert.equal(result.jobId, "55555555-5555-4555-8555-555555555555");
  assert.equal(deps.calls.start.length, 1);
  assert.equal(deps.calls.activate.length, 1);
  assert.equal(deps.calls.activate[0].monitorRunId, "44444444-4444-4444-8444-444444444444");
  assert.equal(deps.calls.activate[0].researchRunId, "55555555-5555-4555-8555-555555555555");
});

test("returns the DB-owned monthly budget pause without an activation", async () => {
  const deps = monitorDeps({ startAtomic: async () => ({ state: "paused", reason: "monthly_credit_limit" }) });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "paused");
  assert.equal(result.reason, "monthly_credit_limit");
  assert.equal(deps.calls.activate.length, 0);
});

test("returns an active duplicate before evaluating a now-exhausted monthly budget", async () => {
  const deps = monitorDeps({
    startAtomic: async () => ({
      state: "running",
      duplicate: true,
      run: { id: "existing-run", status: "running" },
      researchRunId: "existing-research-run",
    }),
  });
  const result = await startMonitorRun(monitorTask({ monthly_credit_used: 20 }), deps);

  assert.equal(result.status, "queued");
  assert.equal(result.duplicate, true);
  assert.equal(result.jobId, "existing-research-run");
  assert.equal(deps.calls.activate.length, 0);
});

test("returns the DB-owned insufficient Credits pause without activating", async () => {
  const deps = monitorDeps({ startAtomic: async () => ({ state: "paused", reason: "insufficient_credits" }) });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "paused");
  assert.equal(result.reason, "insufficient_credits");
  assert.equal(deps.calls.activate.length, 0);
});

test("retries pending activation idempotently without creating another reservation", async () => {
  const deps = monitorDeps({
    startAtomic: async (input) => {
      deps.calls.start.push(input);
      return {
        state: "pending",
        duplicate: true,
        run: { id: "existing-run", status: "pending" },
        researchRunId: "existing-research-run",
      };
    },
  });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "queued");
  assert.equal(result.duplicate, true);
  assert.equal(deps.calls.start.length, 1);
  assert.equal(deps.calls.activate.length, 1);
});

test("activation failure is blocked pending recovery and never reports an unlinked queued job", async () => {
  const deps = monitorDeps({ activateAtomic: async () => ({ state: "blocked" }) });
  const result = await startMonitorRun(monitorTask(), deps);

  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "pending_recovery");
  assert.equal(result.enqueued, false);
  assert.equal(result.jobId, undefined);
});

test("monitor run security migration locks owner identity and browser access", () => {
  const migration = readFileSync("migrations/20260731040000_talent_monitor_run_security.sql", "utf8");

  assert.match(migration, /foreign key \(search_task_id, user_id\)[\s\S]*references public\.search_tasks \(id, user_id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.search_task_runs from public/i);
  assert.match(migration, /search_task_runs_one_active_per_task_idx/i);
  assert.match(migration, /perform public\.release_credits\(v_run\.id/i);
});

test("atomic start migration couples reservation, linked pending records, activation, and exact release reconciliation", () => {
  const migration = readFileSync("migrations/20260731060000_talent_monitor_atomic_start.sql", "utf8");
  const worker = readFileSync("worker/index.mjs", "utf8");

  assert.match(migration, /from public\.search_tasks as task[\s\S]*for update/i);
  assert.match(migration, /from public\.reserve_credits\([\s\S]*p_monitor_run_id/i);
  assert.match(migration, /if SQLERRM = 'insufficient available Credits'/i);
  assert.match(migration, /insert into public\.research_runs[\s\S]*'pending'/i);
  assert.match(migration, /insert into public\.search_task_runs[\s\S]*'pending'/i);
  assert.match(migration, /set status = 'queued'[\s\S]*research\.status = 'pending'/i);
  assert.match(migration, /perform public\.release_credits\(v_run\.id, 'research-run:' \|\| v_run\.id::text \|\| ':release'\)/i);
  assert.doesNotMatch(worker, /claimByStatus\("pending"\)/);
});
