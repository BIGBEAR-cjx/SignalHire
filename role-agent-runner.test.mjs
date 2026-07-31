import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRoleAgentRunRecord,
  runRoleAgentRunCore,
} from "./web/lib/role-agent-runner.mjs";

test("builds a stable background RoleAgentRun record", () => {
  const run = buildRoleAgentRunRecord({
    projectId: "project-1",
    userId: "user-1",
    actionType: "run_sourcing",
    at: "2026-07-04T10:00:00.000Z",
  });

  assert.match(run.run_id, /^role-agent-run_sourcing-project-1-/);
  assert.equal(run.action_type, "run_sourcing");
  assert.equal(run.workflow_step, "run_sourcing");
  assert.equal(run.status, "started");
  assert.equal(run.started_at, "2026-07-04T10:00:00.000Z");
});

test("runs RoleAgentRun sourcing through injected backend dependencies", async () => {
  const events = [];
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "Founding AI Engineer", brief: "Find applied AI engineers" },
    actionType: "run_sourcing",
    now: new Date("2026-07-04T10:00:00.000Z"),
    deps: {
      createSearchTask: async () => ({ id: "task-1" }),
      runSearchTaskNow: async () => ({ jobId: "job-1" }),
      recordEvent: async (event) => events.push(event),
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.result.search_task_id, "task-1");
  assert.equal(result.result.job_id, "job-1");
  assert.deepEqual(events.map((event) => event.action_status), ["started", "succeeded"]);
});

test("treats an already-queued duplicate monitor as successful Role Agent sourcing", async () => {
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "Founding AI Engineer", brief: "Find applied AI engineers" },
    actionType: "run_sourcing",
    deps: {
      createSearchTask: async () => ({ id: "task-1" }),
      runSearchTaskNow: async () => ({ jobId: null, duplicate: true }),
      recordEvent: async () => {},
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.result.duplicate, true);
  assert.equal(result.result.job_id, null);
});

test("persists verified live signals before recording the refresh event", async () => {
  const events = [];
  const order = [];
  let persistenceRows = [];
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer", brief: "AI role" },
    actionType: "refresh_live_signals",
    workspace: {
      signal_refresh: {
        targets: [
          { candidate_id: "c1", candidate_name: "Ada Candidate" },
        ],
      },
    },
    candidateGraph: {
      candidates: [{ candidate_id: "c1", merge_keys: ["github:ada", "name:ada-candidate"] }],
    },
    now: new Date("2026-07-04T10:00:00.000Z"),
    deps: {
      refreshLiveSignals: async () => ({
        refreshed: [{
          candidate_id: "c1",
          provider: "github",
          live_signals: [{
            type: "candidate_activity",
            source: "github",
            confidence: "high",
            observed_at: "2026-07-04T12:00:00.000Z",
            expires_at: "2026-07-11T12:00:00.000Z",
            summary: "Published a new inference optimization project.",
            url: "https://github.com/ada/inference",
          }],
        }],
        failed: [],
      }),
      upsertCandidateLiveSignals: async (rows) => {
        order.push("persist");
        persistenceRows = rows;
        return rows.map((row, index) => ({ ...row, id: `signal-${index + 1}` }));
      },
      recordEvent: async (event) => {
        order.push(`event:${event.action_status}`);
        events.push(event);
      },
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.result.refreshed, 1);
  assert.equal(result.result.persisted_signal_count, 1);
  assert.deepEqual(result.result.signal_ids, ["signal-1"]);
  assert.equal(persistenceRows[0].candidate_merge_key, "github:ada");
  assert.deepEqual(order, ["event:started", "persist", "event:succeeded"]);
  assert.deepEqual(events.map((event) => event.action_status), ["started", "succeeded"]);
});

test("skips invalid live signals instead of persisting them", async () => {
  let receivedRows = null;
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer" },
    actionType: "refresh_live_signals",
    workspace: { signal_refresh: { targets: [{ candidate_id: "c1", candidate_name: "Ada Candidate" }] } },
    candidateGraph: { candidates: [{ candidate_id: "c1", merge_keys: ["github:ada"] }] },
    deps: {
      refreshLiveSignals: async () => ({
        refreshed: [{
          candidate_id: "c1",
          provider: "github",
          live_signals: [{ summary: "Missing evidence URL." }],
        }],
        failed: [],
      }),
      upsertCandidateLiveSignals: async (rows) => {
        receivedRows = rows;
        return [];
      },
    },
  });

  assert.deepEqual(receivedRows, []);
  assert.equal(result.result.refreshed, 0);
  assert.equal(result.result.persisted_signal_count, 0);
  assert.equal(result.failed_items[0].error, "invalid_live_signal");
});

test("blocks live signal refresh when no provider is configured", async () => {
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer" },
    actionType: "refresh_live_signals",
    workspace: { signal_refresh: { targets: [{ candidate_id: "c1", candidate_name: "Ada Candidate" }] } },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.result.provider_ready, false);
  assert.equal(result.result.refreshed, 0);
});

test("does not report synthetic live signal fallback results as refreshed", async () => {
  let persisted = false;
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer" },
    actionType: "refresh_live_signals",
    workspace: { signal_refresh: { targets: [{ candidate_id: "c1", candidate_name: "Ada Candidate" }] } },
    deps: {
      refreshLiveSignals: async () => ({
        synthetic: true,
        refreshed: [{ candidate_id: "c1" }],
        failed: [],
      }),
      upsertCandidateLiveSignals: async () => {
        persisted = true;
        return [];
      },
    },
  });

  assert.equal(result.status, "blocked");
  assert.equal(result.result.refreshed, 0);
  assert.equal(persisted, false);
});

test("runs RoleAgentRun prepare_outreach through contact resolution and approval without sending", async () => {
  const events = [];
  const approved = [];
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer", brief: "AI role" },
    actionType: "prepare_outreach",
    workspace: {
      autopilot_path: {
        run_plan: {
          targets: [
            { id: "thread-1", candidate_name: "Ada Candidate", stage: "ready_for_approval" },
            { id: "thread-2", candidate_name: "Grace Candidate", stage: "ready_for_approval" },
          ],
        },
      },
    },
    now: new Date("2026-07-04T10:00:00.000Z"),
    deps: {
      resolveContacts: async () => ({
        status: "ok",
        summary: { resolved: 1, skipped: 1, failed: 0 },
        items: [{ id: "thread-1", can_send: true }, { id: "thread-2", can_send: true }],
      }),
      approveOutreachDraft: async ({ id }) => {
        approved.push(id);
        return { id, status: "approved" };
      },
      recordEvent: async (event) => events.push(event),
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.result.resolved, 1);
  assert.equal(result.result.approved, 2);
  assert.equal(result.result.sent, 0);
  assert.deepEqual(approved, ["thread-1", "thread-2"]);
  assert.equal(events.at(-1).guardrail, "No emails were sent; first-email send still requires manual confirmation.");
});

test("records partial prepare_outreach approval failures as retryable", async () => {
  const events = [];
  const result = await runRoleAgentRunCore({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer", brief: "AI role" },
    actionType: "prepare_outreach",
    workspace: {
      autopilot_path: {
        run_plan: {
          targets: [
            { id: "thread-1", candidate_name: "Ada Candidate", stage: "ready_for_approval" },
            { id: "thread-2", candidate_name: "Grace Candidate", stage: "ready_for_approval" },
          ],
        },
      },
    },
    now: new Date("2026-07-04T10:00:00.000Z"),
    deps: {
      resolveContacts: async () => ({
        status: "ok",
        summary: { resolved: 0, skipped: 0, failed: 0 },
        items: [{ id: "thread-1", can_send: true }, { id: "thread-2", can_send: true }],
      }),
      approveOutreachDraft: async ({ id }) => (id === "thread-1" ? { id, status: "approved" } : null),
      recordEvent: async (event) => events.push(event),
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.result.approved, 1);
  assert.equal(result.result.failed, 1);
  assert.equal(result.failed_items[0].id, "thread-2");
  assert.equal(events.at(-1).retryable, true);
});
