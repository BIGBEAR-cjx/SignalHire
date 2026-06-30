import test from "node:test";
import assert from "node:assert/strict";
import { buildSequenceAnalyticsView } from "./web/lib/sequence-analytics.mjs";

test("builds role-level sequence analytics without open tracking", () => {
  const view = buildSequenceAnalyticsView({
    roleId: "role-1",
    now: new Date("2026-06-30T12:00:00.000Z"),
    threads: [
      { status: "drafted", sequence_step: 1 },
      { status: "approved", sequence_step: 1, approved_at: "2026-06-29T10:00:00.000Z" },
      { status: "sent", sequence_step: 1, sent_at: "2026-06-29T11:00:00.000Z" },
      { status: "replied", sequence_step: 1, sent_at: "2026-06-28T11:00:00.000Z", reply_summary: "Interested in scope" },
      { status: "bounced", sequence_step: 2, send_error: "bounced" },
      { status: "stopped", sequence_step: 2 },
      { status: "follow_up_scheduled", sequence_step: 2, next_follow_up_at: "2026-06-30T10:00:00.000Z" },
      { status: "interviewing", sequence_step: 3, inbox_classification: "interested" },
    ],
  });

  assert.equal(view.role_id, "role-1");
  assert.deepEqual(view.summary, {
    drafted: 1,
    approved: 1,
    sent: 5,
    opened: null,
    replied: 1,
    interested: 1,
    bounced: 1,
    stopped: 1,
    due_follow_up: 1,
    open_tracking_available: false,
  });
  assert.deepEqual(view.step_performance.find((step) => step.step === 1), {
    step: 1,
    drafted: 1,
    sent: 2,
    replied: 1,
    interested: 0,
    bounced: 0,
  });
  assert.match(view.open_tracking_label, /unavailable/i);
  assert.ok(view.next_actions.some((action) => /review due/i.test(action)));
  assert.ok(view.next_actions.some((action) => /stop bounced/i.test(action)));
  assert.ok(view.next_actions.some((action) => /schedule interested/i.test(action)));
});

test("uses localized next actions while keeping open unavailable", () => {
  const view = buildSequenceAnalyticsView({
    locale: "zh",
    now: new Date("2026-06-30T12:00:00.000Z"),
    threads: [{ status: "follow_up_due", sequence_step: 2 }],
  });

  assert.equal(view.open_tracking_available, false);
  assert.match(view.open_tracking_label, /不可用/);
  assert.ok(view.next_actions.some((action) => /跟进/.test(action)));
});
