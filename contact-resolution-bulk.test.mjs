import test from "node:test";
import assert from "node:assert/strict";
import { runBulkContactResolution } from "./web/lib/contact-resolution-route.mjs";

function thread(id, contactProfile = { emails: [], phones: [] }) {
  return {
    id,
    candidate_snapshot: { name: `Candidate ${id}`, company_domain: "example.ai" },
    contact_profile: contactProfile,
  };
}

test("bulk contact resolution rejects unauthenticated and missing project requests", async () => {
  const unauth = await runBulkContactResolution({
    body: { project_id: "project-1" },
    user: null,
  });
  const missing = await runBulkContactResolution({
    body: {},
    user: { id: "user-1" },
  });

  assert.equal(unauth.status, 401);
  assert.equal(missing.status, 400);
});

test("bulk contact resolution disabled provider returns disabled summary", async () => {
  let listCalled = false;
  const result = await runBulkContactResolution({
    body: { project_id: "project-1" },
    user: { id: "user-1" },
    buildContactProviderConfig: () => ({ provider: "hunter", enabled: false, reason: "missing HUNTER_API_KEY" }),
    listOutreachThreads: async () => {
      listCalled = true;
      return [thread("t1")];
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.provider, "hunter");
  assert.equal(result.body.status, "disabled");
  assert.equal(result.body.reason, "missing HUNTER_API_KEY");
  assert.deepEqual(result.body.summary, { resolved: 0, skipped: 0, failed: 0, cost_units: 0 });
  assert.equal(listCalled, false);
});

test("bulk contact resolution respects max 10 cost guard and summarizes results", async () => {
  const providerCalls = [];
  const updates = [];
  const result = await runBulkContactResolution({
    body: { project_id: "project-1" },
    user: { id: "user-1" },
    buildContactProviderConfig: () => ({ provider: "hunter", enabled: true, reason: "" }),
    listOutreachThreads: async (input) => {
      assert.deepEqual(input, { userId: "user-1", projectId: "project-1" });
      return Array.from({ length: 12 }, (_, index) => thread(`t${index + 1}`));
    },
    resolveHunterContact: async ({ candidate }) => {
      providerCalls.push(candidate.name);
      return {
        contact_profile: {
          emails: [{ value: `${String(candidate.name).replace(/\s+/g, "").toLowerCase()}@example.ai`, source: "hunter", confidence: "high", deliverability_status: "valid" }],
        },
        cost_units: 1,
      };
    },
    updateOutreachThread: async (input) => {
      updates.push(input);
      return input;
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "ok");
  assert.equal(providerCalls.length, 10);
  assert.equal(updates.length, 10);
  assert.deepEqual(result.body.summary, { resolved: 10, skipped: 2, failed: 0, cost_units: 10 });
  assert.equal(result.body.items.length, 12);
  assert.equal(result.body.items.at(-1).reason, "cost_guard_limit");
});

test("bulk contact resolution skips sendable existing contacts", async () => {
  let providerCalls = 0;
  const result = await runBulkContactResolution({
    body: { project_id: "project-1" },
    user: { id: "user-1" },
    buildContactProviderConfig: () => ({ provider: "hunter", enabled: true, reason: "" }),
    listOutreachThreads: async () => [
      thread("t1", {
        emails: [{ value: "existing@example.ai", source: "internal_resume", confidence: "high", deliverability_status: "valid" }],
      }),
      thread("t2"),
    ],
    resolveHunterContact: async () => {
      providerCalls += 1;
      return {
        contact_profile: {
          emails: [{ value: "new@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }],
        },
        cost_units: 1,
      };
    },
    updateOutreachThread: async (input) => input,
  });

  assert.equal(providerCalls, 1);
  assert.deepEqual(result.body.summary, { resolved: 1, skipped: 1, failed: 0, cost_units: 1 });
  assert.equal(result.body.items[0].status, "skipped");
  assert.equal(result.body.items[0].reason, "already_sendable");
});

test("bulk contact resolution skips recent not-found cache entries", async () => {
  let providerCalls = 0;
  const result = await runBulkContactResolution({
    body: { project_id: "project-1" },
    user: { id: "user-1" },
    buildContactProviderConfig: () => ({ provider: "hunter", enabled: true, reason: "" }),
    listOutreachThreads: async () => [
      thread("t1", {
        emails: [],
        resolution: {
          provider: "hunter",
          status: "not_found",
          reason: "no_contact_found",
          searched_at: new Date().toISOString(),
          cost_units: 1,
        },
      }),
    ],
    resolveHunterContact: async () => {
      providerCalls += 1;
      return {};
    },
  });

  assert.equal(providerCalls, 0);
  assert.deepEqual(result.body.summary, { resolved: 0, skipped: 1, failed: 0, cost_units: 0 });
  assert.equal(result.body.items[0].reason, "recent_not_found");
});
