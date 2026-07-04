import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleAgentMetricsSummary } from "./web/lib/role-agent-metrics.mjs";

test("summarizes role agent panel views and next action clicks", () => {
  const viewed = buildRoleAgentMetricsSummary({}, {
    event_type: "panel_view",
    at: "2026-07-03T09:00:00.000Z",
  });

  assert.equal(viewed.panel_views, 1);
  assert.deepEqual(viewed.next_action_clicks, {});
  assert.equal(viewed.last_event_at, "2026-07-03T09:00:00.000Z");
  assert.equal(viewed.recent_events[0].event_type, "panel_view");

  const clicked = buildRoleAgentMetricsSummary(viewed, {
    event_type: "next_action_click",
    action_type: "resolve_contacts",
    at: "2026-07-03T09:01:00.000Z",
  });

  assert.equal(clicked.panel_views, 1);
  assert.equal(clicked.next_action_clicks.resolve_contacts, 1);
  assert.equal(clicked.recent_events[0].event_type, "next_action_click");
  assert.equal(clicked.recent_events[0].action_type, "resolve_contacts");
});

test("keeps role agent settings updates in recent events", () => {
  const summary = buildRoleAgentMetricsSummary({}, {
    event_type: "settings_update",
    action_type: "capacity_goal",
    at: "2026-07-03T09:02:00.000Z",
  });

  assert.equal(summary.settings_updates, 1);
  assert.equal(summary.recent_events[0].event_type, "settings_update");
  assert.equal(summary.recent_events[0].action_type, "capacity_goal");

  const visibility = buildRoleAgentMetricsSummary(summary, {
    event_type: "settings_update",
    action_type: "client_delivery_visibility",
    at: "2026-07-03T09:02:30.000Z",
  });

  assert.equal(visibility.settings_updates, 2);
  assert.equal(visibility.recent_events[0].action_type, "client_delivery_visibility");
});

test("tracks role agent next action execution states", () => {
  const started = buildRoleAgentMetricsSummary({}, {
    event_type: "next_action_execution",
    action_type: "resolve_contacts",
    action_status: "started",
    detail: "Opening contact resolution queue.",
    at: "2026-07-03T09:03:00.000Z",
  });

  assert.equal(started.next_action_runs.resolve_contacts.started, 1);
  assert.equal(started.recent_events[0].event_type, "next_action_execution");
  assert.equal(started.recent_events[0].action_status, "started");
  assert.equal(started.recent_events[0].detail, "Opening contact resolution queue.");

  const failed = buildRoleAgentMetricsSummary(started, {
    event_type: "next_action_execution",
    action_type: "resolve_contacts",
    action_status: "failed",
    detail: "Contact provider unavailable.",
    at: "2026-07-03T09:04:00.000Z",
  });

  assert.equal(failed.next_action_runs.resolve_contacts.started, 1);
  assert.equal(failed.next_action_runs.resolve_contacts.failed, 1);
  assert.equal(failed.recent_events[0].action_status, "failed");
  assert.equal(failed.recent_events[0].detail, "Contact provider unavailable.");
});

test("tracks retry failed outreach execution states", () => {
  const summary = buildRoleAgentMetricsSummary({}, {
    event_type: "next_action_execution",
    action_type: "retry_failed_outreach",
    action_status: "succeeded",
    detail: "2 failed sends retried, 1 still failed.",
    at: "2026-07-03T09:05:00.000Z",
  });

  assert.equal(summary.next_action_runs.retry_failed_outreach.succeeded, 1);
  assert.equal(summary.recent_events[0].action_type, "retry_failed_outreach");
  assert.equal(summary.recent_events[0].detail, "2 failed sends retried, 1 still failed.");
});

test("tracks client report views in role agent metrics", () => {
  const summary = buildRoleAgentMetricsSummary({}, {
    event_type: "client_report_view",
    action_type: "shareable_client_delivery_loop",
    detail: "Public report opened.",
    at: "2026-07-03T09:05:30.000Z",
  });

  assert.equal(summary.client_report_views, 1);
  assert.equal(summary.recent_events[0].event_type, "client_report_view");
  assert.equal(summary.recent_events[0].action_type, "shareable_client_delivery_loop");
});

test("tracks manager feedback from client delivery reports", () => {
  const summary = buildRoleAgentMetricsSummary({}, {
    event_type: "manager_feedback",
    action_type: "client_delivery_feedback",
    action_status: "succeeded",
    detail: "Client feedback: ready_to_interview - Move Ada to interview.",
    at: "2026-07-03T09:05:45.000Z",
  });

  assert.equal(summary.manager_feedback_count, 1);
  assert.equal(summary.recent_events[0].event_type, "manager_feedback");
  assert.equal(summary.recent_events[0].action_type, "client_delivery_feedback");
  assert.equal(summary.recent_events[0].action_status, "succeeded");
});

test("records terminal role agent executions in an execution log", () => {
  const summary = buildRoleAgentMetricsSummary({}, {
    event_type: "next_action_execution",
    action_type: "approve_or_send_outreach",
    action_status: "succeeded",
    detail: "2 ready drafts approved, 1 failed. No emails were sent.",
    targets: [
      { id: "thread-1", candidate_name: "Ready Candidate" },
      { id: "thread-2", candidate_name: "Second Candidate" },
    ],
    result: { approved: 2, failed: 1 },
    failed_items: [
      { id: "thread-3", candidate_name: "Failed Candidate", error: "approval_failed" },
    ],
    retryable: true,
    at: "2026-07-03T09:06:00.000Z",
  });

  assert.equal(summary.execution_log[0].action_type, "approve_or_send_outreach");
  assert.equal(summary.execution_log[0].status, "succeeded");
  assert.equal(summary.execution_log[0].targets[0].candidate_name, "Ready Candidate");
  assert.deepEqual(summary.execution_log[0].result, { approved: 2, failed: 1 });
  assert.deepEqual(summary.execution_log[0].failed_items, [
    { id: "thread-3", candidate_name: "Failed Candidate", error: "approval_failed" },
  ]);
  assert.equal(summary.execution_log[0].retryable, true);
});

test("updates role agent run manifests by run id", () => {
  const started = buildRoleAgentMetricsSummary({}, {
    event_type: "next_action_execution",
    action_type: "approve_or_send_outreach",
    action_status: "started",
    run_id: "run-approval-1",
    workflow_step: "approve_drafts",
    detail: "Starting approval run.",
    targets: [
      { id: "thread-1", candidate_name: "Ready Candidate" },
    ],
    at: "2026-07-03T09:06:00.000Z",
  });

  const finished = buildRoleAgentMetricsSummary(started, {
    event_type: "next_action_execution",
    action_type: "approve_or_send_outreach",
    action_status: "succeeded",
    run_id: "run-approval-1",
    workflow_step: "approve_drafts",
    detail: "1 approved, 1 failed.",
    targets: [
      { id: "thread-1", candidate_name: "Ready Candidate" },
    ],
    result: { approved: 1, failed: 1 },
    failed_items: [
      { id: "thread-2", candidate_name: "Failed Candidate", error: "approval_failed" },
    ],
    retryable: true,
    at: "2026-07-03T09:07:00.000Z",
  });

  assert.equal(finished.role_agent_runs[0].run_id, "run-approval-1");
  assert.equal(finished.role_agent_runs[0].action_type, "approve_or_send_outreach");
  assert.equal(finished.role_agent_runs[0].workflow_step, "approve_drafts");
  assert.equal(finished.role_agent_runs[0].status, "succeeded");
  assert.equal(finished.role_agent_runs[0].started_at, "2026-07-03T09:06:00.000Z");
  assert.equal(finished.role_agent_runs[0].finished_at, "2026-07-03T09:07:00.000Z");
  assert.deepEqual(finished.role_agent_runs[0].result, { approved: 1, failed: 1 });
  assert.deepEqual(finished.role_agent_runs[0].failed_items, [
    { id: "thread-2", candidate_name: "Failed Candidate", error: "approval_failed" },
  ]);
  assert.equal(finished.role_agent_runs[0].retryable, true);
});

test("tracks live signal refresh run manifests", () => {
  const started = buildRoleAgentMetricsSummary({}, {
    event_type: "next_action_execution",
    action_type: "refresh_live_signals",
    action_status: "started",
    run_id: "run-refresh-1",
    workflow_step: "refresh_live_signals",
    targets: [{ id: "stale-signal", candidate_name: "Stale Signal Candidate" }],
    at: "2026-07-03T09:10:00.000Z",
  });
  const blocked = buildRoleAgentMetricsSummary(started, {
    event_type: "next_action_execution",
    action_type: "refresh_live_signals",
    action_status: "blocked",
    run_id: "run-refresh-1",
    workflow_step: "refresh_live_signals",
    detail: "No live signal provider configured.",
    targets: [{ id: "stale-signal", candidate_name: "Stale Signal Candidate" }],
    result: { provider_ready: false, due: 1 },
    failed_items: [{ id: "stale-signal", candidate_name: "Stale Signal Candidate", error: "provider_not_configured" }],
    retryable: true,
    guardrail: "Connect a live signal provider or scheduled refresh job.",
    at: "2026-07-03T09:11:00.000Z",
  });

  assert.equal(blocked.next_action_runs.refresh_live_signals.blocked, 1);
  assert.equal(blocked.role_agent_runs[0].run_id, "run-refresh-1");
  assert.equal(blocked.role_agent_runs[0].action_type, "refresh_live_signals");
  assert.equal(blocked.role_agent_runs[0].status, "blocked");
  assert.equal(blocked.role_agent_runs[0].result.provider_ready, false);
  assert.equal(blocked.role_agent_runs[0].guardrail, "Connect a live signal provider or scheduled refresh job.");
  assert.equal(blocked.execution_log[0].failed_items[0].error, "provider_not_configured");
});

test("ignores unsupported role agent metric events", () => {
  const summary = buildRoleAgentMetricsSummary({
    panel_views: 2,
    next_action_clicks: { run_sourcing: 1 },
    recent_events: [],
  }, {
    event_type: "bad_event",
    action_type: "bad_action",
    at: "not-a-date",
  });

  assert.equal(summary.panel_views, 2);
  assert.deepEqual(summary.next_action_clicks, { run_sourcing: 1 });
  assert.deepEqual(summary.recent_events, []);
});
