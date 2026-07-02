import test from "node:test";
import assert from "node:assert/strict";
import { buildRoleOutreachSettings, canAutoSendFollowUp } from "./web/lib/outreach-settings.mjs";

test("builds role outreach settings with conservative defaults", () => {
  assert.deepEqual(buildRoleOutreachSettings({}), {
    auto_follow_up_only: false,
    follow_up_interval_days: 7,
    client_visible_digest: true,
    agent_status: "active",
    approval_mode: "manual_all",
    capacity_goal: {
      contacted: 0,
      replied: 0,
      interested: 0,
      interview_ready: 0,
    },
  });

  assert.deepEqual(buildRoleOutreachSettings({
    auto_follow_up_only: true,
    follow_up_interval_days: 14,
    client_visible_digest: false,
    agent_status: "paused",
    approval_mode: "auto_follow_up_only",
    capacity_goal: {
      contacted: "12.9",
      replied: 4.2,
      interested: -3,
      interview_ready: "bad",
    },
  }), {
    auto_follow_up_only: true,
    follow_up_interval_days: 7,
    client_visible_digest: false,
    agent_status: "paused",
    approval_mode: "auto_follow_up_only",
    capacity_goal: {
      contacted: 12,
      replied: 4,
      interested: 0,
      interview_ready: 0,
    },
  });
});

test("normalizes unsafe approval modes into manual persisted settings", () => {
  assert.deepEqual(buildRoleOutreachSettings({
    auto_follow_up_only: true,
    approval_mode: "auto_high_confidence",
    auto_high_confidence: true,
  }), {
    auto_follow_up_only: false,
    follow_up_interval_days: 7,
    client_visible_digest: true,
    agent_status: "active",
    approval_mode: "manual_all",
    capacity_goal: {
      contacted: 0,
      replied: 0,
      interested: 0,
      interview_ready: 0,
    },
  });

  assert.deepEqual(buildRoleOutreachSettings({
    auto_follow_up_only: true,
    approval_mode: "manual_all",
  }), {
    auto_follow_up_only: false,
    follow_up_interval_days: 7,
    client_visible_digest: true,
    agent_status: "active",
    approval_mode: "manual_all",
    capacity_goal: {
      contacted: 0,
      replied: 0,
      interested: 0,
      interview_ready: 0,
    },
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
