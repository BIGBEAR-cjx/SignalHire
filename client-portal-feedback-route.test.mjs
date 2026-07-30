import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  handleClientPortalFeedbackPost,
  normalizeClientFeedback,
} from "./web/lib/client-report-feedback.mjs";

function dependencies(overrides = {}) {
  return {
    getUser: async () => ({ id: "client-user", email: "real@client.ai" }),
    findAuthorizedProject: async () => ({ id: "project-1", user_id: "owner-1" }),
    findProjectReport: async () => ({ id: "report-1", kind: "search" }),
    clientPortalReportHref: () => "/r/report-1?lang=en",
    recordProjectRoleAgentEvent: async () => ({ manager_feedback_count: 1 }),
    normalizeLocale: (value) => value === "en" ? "en" : "zh",
    t: (_locale, key) => key,
    now: () => new Date("2026-07-30T08:00:00.000Z"),
    ...overrides,
  };
}

async function post(body, overrides = {}) {
  return handleClientPortalFeedbackPost({
    req: new Request("https://signalhire.test/api/client-portal/projects/project-1/feedback", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
    projectId: "project-1",
    dependencies: dependencies(overrides),
  });
}

test("normalizes feedback with the server-owned actor and report version", () => {
  assert.equal(
    normalizeClientFeedback(
      { sentiment: "ready_to_interview", note: "Strong evidence", reviewer: "forged@x.com" },
      { actorEmail: "real@client.ai", reportId: "r1" },
    ).actor,
    "real@client.ai",
  );
  assert.equal(
    normalizeClientFeedback(
      { sentiment: "ready_to_interview", note: "Strong evidence" },
      { actorEmail: "   ", reportId: "r1" },
    ),
    null,
  );
  assert.equal(normalizeClientFeedback({}, { actorEmail: "", reportId: "r1" }), null);
  assert.equal(normalizeClientFeedback({}, { actorEmail: "real@client.ai", reportId: "" }), null);
});

test("persists the authenticated actor rather than a reviewer in the body", async () => {
  let recorded = null;
  const response = await post({
    report_id: "report-1",
    sentiment: "ready_to_interview",
    note: "Strong evidence",
    reviewer: "forged@x.com",
    locale: "en",
  }, {
    recordProjectRoleAgentEvent: async (input) => {
      recorded = input;
      return { manager_feedback_count: 1 };
    },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.feedback.actor, "real@client.ai");
  assert.equal(payload.feedback.reviewer, undefined);
  assert.equal(recorded.event.detail.includes("forged@x.com"), false);
  assert.match(recorded.event.detail, /real@client\.ai/);
});

test("rejects a request without an explicit report version", async () => {
  const response = await post({ sentiment: "ready_to_interview", note: "Strong evidence", locale: "en" });
  assert.equal(response.status, 400);
});

test("rejects a report outside the authorized project", async () => {
  const response = await post({
    report_id: "other-project-report",
    sentiment: "ready_to_interview",
    note: "Strong evidence",
  }, {
    findProjectReport: async () => null,
  });
  assert.equal(response.status, 404);
});

test("requires a logged-in customer account", async () => {
  const response = await post({
    report_id: "report-1",
    sentiment: "ready_to_interview",
    note: "Strong evidence",
  }, {
    getUser: async () => null,
  });
  assert.equal(response.status, 401);
});

test("client project feedback sends a root report-version payload without a reviewer", () => {
  const source = readFileSync("web/app/client/projects/[id]/page.tsx", "utf8");

  assert.match(source, /body: JSON\.stringify\(\{ report_id: selectedReportId, sentiment, note, locale \}\)/);
  assert.doesNotMatch(source, /feedback:\s*\{[^}]*reviewer/);
});
