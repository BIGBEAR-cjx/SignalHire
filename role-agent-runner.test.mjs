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

test("runs RoleAgentRun refresh_live_signals through the live signal provider", async () => {
  const events = [];
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
    now: new Date("2026-07-04T10:00:00.000Z"),
    deps: {
      refreshLiveSignals: async () => ({ refreshed: [{ candidate_id: "c1", signal_count: 1 }], failed: [] }),
      recordEvent: async (event) => events.push(event),
    },
  });

  assert.equal(result.status, "succeeded");
  assert.equal(result.result.refreshed, 1);
  assert.deepEqual(events.map((event) => event.action_status), ["started", "succeeded"]);
});
