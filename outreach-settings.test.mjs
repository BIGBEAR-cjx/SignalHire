import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleOutreachSettings, canAutoSendFollowUp } from "./web/lib/outreach-settings.mjs";

test("builds role outreach settings with conservative defaults", () => {
  assert.deepEqual(buildRoleOutreachSettings({}), {
    auto_follow_up_only: false,
    follow_up_interval_days: 7,
    client_visible_digest: true,
  });

  assert.deepEqual(buildRoleOutreachSettings({
    auto_follow_up_only: true,
    follow_up_interval_days: 14,
    client_visible_digest: false,
  }), {
    auto_follow_up_only: true,
    follow_up_interval_days: 7,
    client_visible_digest: false,
  });
});

test("auto send only applies to approved follow-up steps on active threads", () => {
  const settings = buildRoleOutreachSettings({ auto_follow_up_only: true });

  assert.equal(canAutoSendFollowUp({
    settings,
    message: { step: 1, send_mode: "manual_approval_required", approved: true },
    thread: { status: "approved" },
  }), false);

  assert.equal(canAutoSendFollowUp({
    settings,
    message: { step: 2, send_mode: "draft_for_review", approved: true },
    thread: { status: "sent" },
  }), true);

  assert.equal(canAutoSendFollowUp({
    settings,
    message: { step: 3, send_mode: "draft_for_review", approved: true },
    thread: { status: "follow_up_scheduled" },
  }), true);

  assert.equal(canAutoSendFollowUp({
    settings,
    message: { step: 2, send_mode: "draft_for_review", approved: false },
    thread: { status: "sent" },
  }), false);
});

test("auto send is blocked when the setting is off or the thread stopped", () => {
  const message = { step: 2, send_mode: "draft_for_review", approved: true };

  assert.equal(canAutoSendFollowUp({
    settings: buildRoleOutreachSettings({ auto_follow_up_only: false }),
    message,
    thread: { status: "sent" },
  }), false);

  for (const status of ["stopped", "replied", "bounced", "not_interested"]) {
    assert.equal(canAutoSendFollowUp({
      settings: buildRoleOutreachSettings({ auto_follow_up_only: true }),
      message,
      thread: { status },
    }), false);
  }
});
