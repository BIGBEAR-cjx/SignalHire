import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  classifyMonitorCandidates,
  limitMonitorCandidates,
  monitorBatchSize,
  monitorNotificationPayload,
  prepareMonitorResult,
} from "./worker/talent-monitor-settlement.mjs";

const runId = "11111111-1111-4111-8111-111111111111";

function candidate(name, url = "https://evidence.example/profile") {
  return {
    name,
    current_company: "Example",
    current_role: "Engineer",
    claims: [{ evidence: [{ url }] }],
  };
}

test("caps archived monitor candidates to the immutable snapshot batch size", () => {
  assert.equal(limitMonitorCandidates([1, 2, 3, 4, 5, 6], 5).length, 5);
  assert.equal(monitorBatchSize({ candidate_batch_size: 20 }), 20);
  assert.throws(() => monitorBatchSize({ candidate_batch_size: 7 }), /snapshot.*batch size/i);
});

test("classifies new, updated, seen, and skipped monitor candidates", () => {
  const classified = classifyMonitorCandidates({
    candidateBatchSize: 5,
    candidates: [
      candidate("New"),
      candidate("Seen", "https://known.example/a"),
      candidate("Updated", "https://known.example/b"),
      candidate("Skipped 1"),
      candidate("Skipped 2"),
      candidate("Skipped 3"),
    ],
    knownProfiles: [
      { ...candidate("Seen", "https://known.example/a"), evidence_urls: ["https://known.example/a"] },
      { ...candidate("Updated", "https://known.example/a"), evidence_urls: ["https://known.example/a"] },
    ],
  });

  assert.deepEqual(classified.summary, {
    requested_count: 5,
    returned_count: 5,
    new_candidates: 3,
    seen_candidates: 1,
    updated_candidates: 1,
    skipped_candidates: 1,
  });
  assert.equal(classified.items[1].discovery_state, "seen_before");
  assert.equal(classified.items[2].evidence_updated, true);
});

test("prepares only new or evidence-updated candidates for a deduplicated notification", () => {
  const result = prepareMonitorResult({
    monitorRunId: runId,
    configSnapshot: { candidate_batch_size: 5, notification_enabled: true },
    knownProfiles: [{ ...candidate("Seen", "https://known.example/a"), evidence_urls: ["https://known.example/a"] }],
    result: { candidates: [candidate("New"), candidate("Seen", "https://known.example/a")] },
  });

  assert.deepEqual(result.task_discovery.notification, {
    type: "talent_monitor_discovery",
    dedupe_key: `monitor-run:${runId}:discovery`,
    candidates: [{
      candidate_index: 0,
      cache_key: "new:example:engineer",
      name: "New",
      discovery_state: "new_candidate",
      evidence_updated: false,
    }],
  });
  assert.equal(monitorNotificationPayload({ monitorRunId: runId, configSnapshot: { notification_enabled: false }, discovery: result.task_discovery }), null);
});

test("terminal monitor migration settles after research persistence and releases failures once", () => {
  const migration = readFileSync("migrations/20260731070000_settle_talent_monitor_runs.sql", "utf8");
  const worker = readFileSync("worker/index.mjs", "utf8");
  const settlement = readFileSync("worker/talent-monitor-settlement.mjs", "utf8");

  assert.match(migration, /create or replace function public\.settle_monitor_run\(p_research_run_id uuid\)/i);
  assert.match(migration, /research\.status <> 'done'/i);
  assert.match(migration, /perform public\.settle_credits\(\s*v_run\.id,\s*v_run\.credits_reserved/i);
  assert.match(migration, /create or replace function public\.release_monitor_run\(\s*p_research_run_id uuid/i);
  assert.match(migration, /perform public\.release_credits\(v_run\.id, 'research-run:' \|\| v_run\.id::text \|\| ':release'\)/i);
  assert.match(migration, /v_run\.status in \('done', 'failed', 'cancelled'\)/i);
  assert.match(worker, /await settleMonitorRun\(job\.id\)/);
  assert.match(worker, /await releaseMonitorRun\(job\.id, failureRow\.status\)/);
  assert.match(worker, /nextAttempt > max[\s\S]*await releaseMonitorRun\(job\.id, "error"\)/);
  assert.doesNotMatch(settlement, /outreach/i);
});

test("terminal monitor RPCs reject mismatched research and Credits reservation linkages before ledger mutation", () => {
  const migration = readFileSync("migrations/20260731070000_settle_talent_monitor_runs.sql", "utf8");
  const settlementStart = migration.indexOf("create or replace function public.settle_monitor_run");
  const releaseStart = migration.indexOf("create or replace function public.release_monitor_run");
  const reconciliationStart = migration.indexOf("create or replace function public.reconcile_monitor_run_outcomes");
  const settle = migration.slice(settlementStart, releaseStart);
  const release = migration.slice(releaseStart, reconciliationStart);

  for (const terminalRpc of [settle, release]) {
    assert.match(terminalRpc, /declare[\s\S]*v_reservation public\.credit_reservations%rowtype;/i);
    assert.match(terminalRpc, /v_research\.user_id <> v_run\.user_id\s+or v_research\.search_task_id <> v_run\.search_task_id/i);
    assert.match(terminalRpc, /from public\.credit_reservations as reservation\s+where reservation\.id = v_run\.credit_reservation_id\s+for update/i);
    assert.match(terminalRpc, /v_reservation\.run_id <> v_run\.id[\s\S]*v_reservation\.user_id <> v_run\.user_id[\s\S]*v_reservation\.reserved_amount <> v_run\.credits_reserved[\s\S]*v_reservation\.status <> 'reserved'/i);
  }
  assert.ok(settle.indexOf("monitor run research linkage is invalid") < settle.indexOf("perform public.settle_credits"));
  assert.ok(release.indexOf("monitor run research linkage is invalid") < release.indexOf("perform public.release_credits"));
});
