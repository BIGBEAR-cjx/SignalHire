import test from "node:test";
import assert from "node:assert/strict";
import { buildOutreachApprovalOutcome, selectOutreachApprovalRetryTargets, selectOutreachReadinessTargets } from "./web/lib/outreach-readiness.mjs";

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

test("builds approval outcome states for no targets, success, partial failure, and all failed", () => {
  assert.deepEqual(buildOutreachApprovalOutcome({ targets: [] }), {
    attempted: 0,
    approved: 0,
    failed: 0,
    status: "none",
    failed_items: [],
  });

  assert.deepEqual(buildOutreachApprovalOutcome({
    targets: [{ id: "t1", name: "Ada" }, { id: "t2", name: "Grace" }],
    approved: ["t1", "t2"],
  }), {
    attempted: 2,
    approved: 2,
    failed: 0,
    status: "all_approved",
    failed_items: [],
  });

  assert.deepEqual(buildOutreachApprovalOutcome({
    targets: [{ id: "t1", name: "Ada" }, { id: "t2", name: "Grace" }],
    approved: ["t1"],
    failed: [{ id: "t2", name: "Grace", error: "network" }],
  }), {
    attempted: 2,
    approved: 1,
    failed: 1,
    status: "partial_failed",
    failed_items: [{ id: "t2", name: "Grace", error: "network" }],
  });

  assert.deepEqual(buildOutreachApprovalOutcome({
    targets: [{ id: "t1", name: "Ada" }],
    failed: [{ id: "t1", name: "Ada", error: "patch_failed" }],
  }), {
    attempted: 1,
    approved: 0,
    failed: 1,
    status: "all_failed",
    failed_items: [{ id: "t1", name: "Ada", error: "patch_failed" }],
  });
});

test("selects only current drafted failed approval rows for retry", () => {
  const targets = selectOutreachApprovalRetryTargets({
    failedItems: [
      { id: "retry-1", name: "Ada", error: "network" },
      { id: "missing", name: "Missing", error: "not_found" },
      { id: "sent", name: "Sent", error: "already_sent" },
      { id: "retry-1", name: "Ada duplicate", error: "network" },
      { id: " ", name: "Blank", error: "blank" },
      { id: "retry-2", name: "Grace", error: "timeout" },
    ],
    items: [
      item("retry-1"),
      item("sent", { status: "sent" }),
      item("retry-2"),
    ],
  });

  assert.deepEqual(targets, ["retry-1", "retry-2"]);
});
