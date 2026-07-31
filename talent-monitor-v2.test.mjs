import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildNextRunAt,
  nextRunAfterPatch,
  normalizeMonitorInput,
  snapshotMonitorConfig,
} from "./web/lib/search-tasks.mjs";

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
