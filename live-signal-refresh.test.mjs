import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLiveSignalRefreshEvent,
  buildLiveSignalRefreshSummary,
  selectLiveSignalRefreshProjects,
} from "./web/lib/live-signal-refresh.mjs";

test("selects active projects with stale live signals for scheduled refresh", () => {
  const projects = [
    { id: "p1", user_id: "u1", status: "open", role_agent_workspace: { signal_refresh: { due_count: 2 } } },
    { id: "p2", user_id: "u1", status: "paused", role_agent_workspace: { signal_refresh: { due_count: 3 } } },
    { id: "p3", user_id: "u2", status: "open", role_agent_workspace: { signal_refresh: { due_count: 0 } } },
  ];

  const selected = selectLiveSignalRefreshProjects(projects, { limit: 5 });

  assert.deepEqual(selected.map((project) => project.id), ["p1"]);
});

test("builds live signal refresh metric event from provider results", () => {
  const event = buildLiveSignalRefreshEvent({
    runId: "live-signal-run-1",
    targets: [
      { candidate_id: "c1", candidate_name: "Ada Candidate" },
      { candidate_id: "c2", candidate_name: "Grace Candidate" },
    ],
    refreshed: [{ candidate_id: "c1", signal_count: 2 }],
    failed: [{ candidate_id: "c2", error: "provider_timeout" }],
    at: "2026-07-04T10:00:00.000Z",
  });

  assert.equal(event.event_type, "next_action_execution");
  assert.equal(event.action_type, "refresh_live_signals");
  assert.equal(event.action_status, "succeeded");
  assert.equal(event.result.refreshed, 1);
  assert.equal(event.result.failed, 1);
  assert.equal(event.failed_items[0].error, "provider_timeout");
  assert.equal(event.retryable, true);
});

test("summarizes scheduled live signal refresh without exposing provider internals", () => {
  const summary = buildLiveSignalRefreshSummary([
    { project_id: "p1", status: "succeeded", refreshed: 2, failed: 0 },
    { project_id: "p2", status: "blocked", refreshed: 0, failed: 1, error: "provider_not_configured" },
  ]);

  assert.deepEqual(summary, {
    checked: 2,
    refreshed: 2,
    failed: 1,
    blocked: 1,
    ok: false,
    errors: [{ project_id: "p2", error: "provider_not_configured" }],
  });
  assert.doesNotMatch(JSON.stringify(summary), /access_token|secret|debug/i);
});
