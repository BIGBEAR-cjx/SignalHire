import test from "node:test";
import assert from "node:assert/strict";
import { buildAgencyOutreachActivityDigest } from "./web/lib/outreach-activity-digest.mjs";

test("builds a customer-visible outreach activity digest", () => {
  const digest = buildAgencyOutreachActivityDigest({
    roleName: "Founding ML Engineer",
    threads: [
      {
        candidate_name: "Ada Lovelace",
        status: "follow_up_scheduled",
        last_activity: "First email sent on 2026-06-30",
        next_follow_up_at: "2026-07-07T10:00:00.000Z",
        evidence_angle: "Published GPU inference benchmarks",
        contact_profile: {
          emails: [
            {
              value: "ada@example.ai",
              source: "hunter",
              confidence: "high",
              deliverability_status: "valid",
              raw_reference: "secret-provider-row",
            },
          ],
          resolution: { cost_units: 3, raw_reference: "internal-request-id" },
        },
        reply_summary: "Asked for more details about team scope.",
        private_notes: "Do not show the client.",
        error: { stack: "Error: provider failed\n    at internal.js:1:1" },
      },
    ],
  });

  assert.match(digest, /Founding ML Engineer/);
  assert.match(digest, /Ada Lovelace/);
  assert.match(digest, /follow_up_scheduled/);
  assert.match(digest, /2026-07-07T10:00:00.000Z/);
  assert.match(digest, /Published GPU inference benchmarks/);
  assert.match(digest, /hunter/);
  assert.match(digest, /high/);
  assert.match(digest, /valid/);
  assert.match(digest, /Asked for more details/);
  assert.doesNotMatch(digest, /secret-provider-row|internal-request-id|cost_units|private_notes|Do not show|provider failed|internal\.js/);
});

test("summarizes missing optional fields without exposing internal fields", () => {
  const digest = buildAgencyOutreachActivityDigest({
    roleName: "",
    threads: [{ candidate_name: "", status: "", contact_profile: { emails: [] }, raw_reference: "hidden" }],
  });

  assert.match(digest, /Role/);
  assert.match(digest, /Unknown candidate/);
  assert.match(digest, /draft/);
  assert.match(digest, /No sourced contact yet/);
  assert.doesNotMatch(digest, /hidden/);
});

test("adds aggregate sequence analytics to client digest", () => {
  const digest = buildAgencyOutreachActivityDigest({
    roleName: "Founding ML Engineer",
    sequenceAnalytics: {
      summary: {
        drafted: 2,
        approved: 1,
        sent: 5,
        replied: 2,
        interested: 1,
        bounced: 1,
        stopped: 1,
        due_follow_up: 2,
        open_tracking_available: false,
      },
      step_performance: [{ step: 1, drafted: 1, sent: 3, replied: 2, interested: 1, bounced: 0 }],
      next_actions: ["Review due follow-up drafts"],
    },
    threads: [],
  });

  assert.match(digest, /Sequence analytics/);
  assert.match(digest, /Sent: 5/);
  assert.match(digest, /Open tracking: unavailable/);
  assert.match(digest, /Step 1: sent 3, replied 2, interested 1, bounced 0/);
  assert.doesNotMatch(digest, /private_notes|raw_reference/);
});
