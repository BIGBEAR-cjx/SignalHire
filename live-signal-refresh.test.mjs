import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLiveSignalRefreshEvent,
  buildLiveSignalRefreshSummary,
  createInternalLiveSignalProvider,
  createHttpLiveSignalProvider,
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

test("refreshes live signals through an external HTTP provider", async () => {
  const requests = [];
  const provider = createHttpLiveSignalProvider({
    url: "https://signals.example.com/refresh",
    apiKey: "provider-secret",
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return {
        ok: true,
        json: async () => ({
          refreshed: [
            {
              candidate_id: "c1",
              candidate_name: "Ada Candidate",
              signals: [
                {
                  type: "candidate_activity",
                  source: "github",
                  confidence: "high",
                  freshness: "fresh",
                  observed_at: "2026-07-04T12:00:00.000Z",
                  expires_at: "2026-07-11T12:00:00.000Z",
                  summary: "Published a new inference optimization project.",
                  url: "https://github.com/ada/inference",
                },
              ],
            },
          ],
          failed: [],
        }),
      };
    },
  });

  const result = await provider.refresh({
    userId: "user-1",
    project: { id: "project-1", name: "AI Engineer" },
    targets: [{ candidate_id: "c1", candidate_name: "Ada Candidate" }],
  });

  assert.equal(requests[0].url, "https://signals.example.com/refresh");
  assert.equal(requests[0].init.headers.Authorization, "Bearer provider-secret");
  assert.deepEqual(JSON.parse(requests[0].init.body).targets, [{ candidate_id: "c1", candidate_name: "Ada Candidate" }]);
  assert.equal(result.refreshed[0].signal_count, 1);
  assert.equal(result.refreshed[0].live_signals[0].type, "candidate_activity");
  assert.equal(result.failed.length, 0);
});

test("redacts external live signal provider failures", async () => {
  const provider = createHttpLiveSignalProvider({
    url: "https://signals.example.com/refresh",
    fetchImpl: async () => ({
      ok: false,
      status: 500,
      text: async () => "provider failed api_key=secret-token debug trace",
    }),
  });

  const result = await provider.refresh({
    targets: [{ candidate_id: "c1", candidate_name: "Ada Candidate" }],
  });

  assert.equal(result.refreshed.length, 0);
  assert.equal(result.failed[0].candidate_id, "c1");
  assert.match(result.error, /api_key=redacted/);
  assert.doesNotMatch(result.error, /secret-token|debug trace/);
});

test("internal live signal provider refreshes targets without external configuration", async () => {
  const provider = createInternalLiveSignalProvider();
  const result = await provider.refresh({
    project: { id: "project-1", name: "AI Engineer" },
    targets: [{ candidate_id: "c1", candidate_name: "Ada Candidate" }],
  });

  assert.equal(result.failed.length, 0);
  assert.equal(result.refreshed[0].candidate_id, "c1");
  assert.equal(result.refreshed[0].provider, "internal_live_signal_provider");
  assert.equal(result.refreshed[0].live_signals[0].type, "profile_freshness");
  assert.match(result.refreshed[0].live_signals[0].summary, /AI Engineer/);
});
