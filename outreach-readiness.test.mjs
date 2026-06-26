import test from "node:test";
import assert from "node:assert/strict";
import { selectOutreachReadinessTargets } from "./web/lib/outreach-readiness.mjs";

function item(id, overrides = {}) {
  return {
    id,
    status: "drafted",
    contact_profile: { emails: [], phones: [] },
    ...overrides,
  };
}

test("selects existing and newly resolved drafted outreach threads in queue order", () => {
  const targets = selectOutreachReadinessTargets({
    items: [
      item("existing", {
        contact_profile: {
          emails: [{ value: "existing@example.ai", source: "internal_resume", confidence: "high", deliverability_status: "valid" }],
        },
      }),
      item("resolved"),
      item("failed"),
      item("already-approved", { status: "approved" }),
    ],
    contactResult: {
      items: [
        { id: "resolved", can_send: true, status: "resolved" },
        { id: "failed", can_send: false, status: "error" },
        { id: "already-approved", can_send: true, status: "resolved" },
      ],
    },
  });

  assert.deepEqual(targets, ["existing", "resolved"]);
});

test("excludes low-confidence emails, duplicate bulk ids, and non-drafted items", () => {
  const targets = selectOutreachReadinessTargets({
    items: [
      item("low", {
        contact_profile: {
          emails: [{ value: "low@example.ai", source: "hunter", confidence: "low", deliverability_status: "valid" }],
        },
      }),
      item("dupe"),
      item("sent", { status: "sent" }),
    ],
    contactResult: {
      items: [
        { id: "dupe", can_send: true, status: "resolved" },
        { id: "dupe", can_send: true, status: "resolved" },
        { id: "sent", can_send: true, status: "resolved" },
      ],
    },
  });

  assert.deepEqual(targets, ["dupe"]);
});

test("does not approve malformed failed bulk rows even when can_send is true", () => {
  const targets = selectOutreachReadinessTargets({
    items: [item("bad-provider-row")],
    contactResult: {
      items: [{ id: "bad-provider-row", can_send: true, status: "error", reason: "provider_error" }],
    },
  });

  assert.deepEqual(targets, []);
});
