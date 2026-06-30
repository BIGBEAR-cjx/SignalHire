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
