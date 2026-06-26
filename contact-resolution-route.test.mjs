import test from "node:test";
import assert from "node:assert/strict";
import { runContactResolution } from "./web/lib/contact-resolution-route.mjs";

test("contact resolution route core rejects unauthenticated and missing thread requests", async () => {
  const unauth = await runContactResolution({
    body: { outreach_thread_id: "thread-1" },
    user: null,
  });
  const missing = await runContactResolution({
    body: {},
    user: { id: "user-1" },
  });

  assert.equal(unauth.status, 401);
  assert.equal(missing.status, 400);
});

test("contact resolution route core fetches only the user's outreach thread", async () => {
  const calls = [];
  const result = await runContactResolution({
    body: { outreach_thread_id: "thread-1" },
    user: { id: "user-1" },
    getOutreachThread: async (input) => {
      calls.push(input);
      return null;
    },
  });

  assert.equal(result.status, 404);
  assert.deepEqual(calls, [{ userId: "user-1", id: "thread-1" }]);
});

test("contact resolution disabled provider preserves existing contacts without update", async () => {
  let updateCalled = false;
  const result = await runContactResolution({
    body: { outreach_thread_id: "thread-1" },
    user: { id: "user-1" },
    getOutreachThread: async () => ({
      candidate_snapshot: { name: "Ada" },
      contact_profile: { emails: [{ value: "ada@example.ai", source: "internal_resume", confidence: "high" }] },
    }),
    buildContactProviderConfig: () => ({ provider: "hunter", enabled: false, reason: "missing HUNTER_API_KEY" }),
    updateOutreachThread: async () => {
      updateCalled = true;
      return {};
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "disabled");
  assert.equal(result.body.contact_profile.emails[0].value, "ada@example.ai");
  assert.equal(updateCalled, false);
});

test("contact resolution route core writes back resolved contact profile", async () => {
  const updates = [];
  const result = await runContactResolution({
    body: { outreach_thread_id: "thread-1" },
    user: { id: "user-1" },
    getOutreachThread: async () => ({
      candidate_snapshot: { name: "Ada", company_domain: "example.ai" },
      contact_profile: { emails: [], phones: [] },
    }),
    buildContactProviderConfig: () => ({ provider: "hunter", enabled: true, reason: "" }),
    resolveHunterContact: async () => ({
      contact_profile: {
        emails: [{ value: "ada@example.ai", source: "hunter", confidence: "high", deliverability_status: "valid" }],
      },
      cost_units: 1,
      raw_reference: "https://example.ai/team",
    }),
    updateOutreachThread: async (input) => {
      updates.push(input);
      return { id: input.id };
    },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.status, "resolved");
  assert.equal(result.body.send_eligibility.can_send, true);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].userId, "user-1");
  assert.equal(updates[0].id, "thread-1");
  assert.equal(updates[0].contact_profile.emails[0].value, "ada@example.ai");
  assert.equal(updates[0].send_error, "");
});
