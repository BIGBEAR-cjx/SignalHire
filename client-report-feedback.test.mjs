import test from "node:test";
import assert from "node:assert/strict";
import { buildClientReportFeedbackEvent, normalizeClientReportFeedback } from "./web/lib/client-report-feedback.mjs";

test("normalizes client report feedback into client-safe fields", () => {
  const feedback = normalizeClientReportFeedback({
    sentiment: "needs_more_candidates",
    reviewer: "  Hiring Manager  ",
    note: "Need more infra candidates.\nAvoid internal debug notes.",
  });

  assert.deepEqual(feedback, {
    sentiment: "needs_more_candidates",
    reviewer: "Hiring Manager",
    note: "Need more infra candidates. Avoid internal debug notes.",
  });
});

test("rejects invalid or empty client report feedback", () => {
  assert.equal(normalizeClientReportFeedback({ sentiment: "unknown", note: "Looks good" }), null);
  assert.equal(normalizeClientReportFeedback({ sentiment: "ready_to_interview", note: "" }), null);
});

test("builds a role agent manager feedback event", () => {
  const event = buildClientReportFeedbackEvent({
    feedback: {
      sentiment: "ready_to_interview",
      reviewer: "Client",
      note: "Move Ada to interview next week.",
    },
    reportHref: "/r/run-1?t=token",
    now: new Date("2026-07-03T13:00:00.000Z"),
  });

  assert.equal(event.event_type, "manager_feedback");
  assert.equal(event.action_type, "client_delivery_feedback");
  assert.equal(event.action_status, "succeeded");
  assert.match(event.detail, /ready_to_interview/);
  assert.match(event.detail, /Client/);
  assert.match(event.detail, /Move Ada/);
  assert.equal(event.at, "2026-07-03T13:00:00.000Z");
});
