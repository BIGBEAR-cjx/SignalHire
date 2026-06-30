import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDueFollowUpDraftPatch,
  buildFollowUpDraftRunSummary,
  latestFollowUpDraftState,
} from "./web/lib/outreach-followups.mjs";

const now = new Date("2026-06-30T10:00:00.000Z");

function baseThread(patch = {}) {
  return {
    id: "thread-1",
    candidate_name: "Ada Lovelace",
    status: "sent",
    subject: "Ada, quick note",
    body: "Original first email",
    notes: "",
    gmail_thread_id: "gmail-thread-1",
    next_follow_up_at: "2026-06-30T09:00:00.000Z",
    sequence_messages: [
      { step: 1, subject: "Ada, quick note", body: "First email", send_mode: "manual_approval_required" },
      { step: 2, subject: "Re: Ada, quick note", body: "Follow-up one", send_mode: "draft_for_review", delay_days: 7 },
      { step: 3, subject: "Re: Ada, quick note", body: "Follow-up two", send_mode: "draft_for_review", delay_days: 7 },
    ],
    ...patch,
  };
}

test("does not schedule follow-up drafts when auto_follow_up_only is off", () => {
  const result = buildDueFollowUpDraftPatch({
    thread: baseThread(),
    settings: { auto_follow_up_only: false },
    now,
  });

  assert.deepEqual(result, { ok: false, reason: "auto_follow_up_disabled" });
});

test("does not schedule when follow-up is not due", () => {
  const result = buildDueFollowUpDraftPatch({
    thread: baseThread({ next_follow_up_at: "2026-07-01T09:00:00.000Z" }),
    settings: { auto_follow_up_only: true },
    now,
  });

  assert.deepEqual(result, { ok: false, reason: "not_due" });
});

test("does not schedule stopped, replied, bounced, or hired threads", () => {
  for (const status of ["stopped", "replied", "bounced", "not_interested", "hired"]) {
    const result = buildDueFollowUpDraftPatch({
      thread: baseThread({ status }),
      settings: { auto_follow_up_only: true },
      now,
    });

    assert.deepEqual(result, { ok: false, reason: "thread_stopped" });
  }
});

test("schedules step 2 as a review draft without sending email", () => {
  const result = buildDueFollowUpDraftPatch({
    thread: baseThread(),
    settings: { auto_follow_up_only: true },
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.step, 2);
  assert.equal(result.patch.status, "follow_up_due");
  assert.equal(result.patch.subject, "Re: Ada, quick note");
  assert.equal(result.patch.body, "Follow-up one");
  assert.equal(result.patch.next_follow_up_at, null);
  assert.equal(result.patch.send_error, "");
  assert.match(result.patch.notes, /signalhire-follow-up-draft/);
  assert.doesNotMatch(JSON.stringify(result.patch), /gmail_message_id|sent_at|last_contacted_at/);
});

test("schedules step 3 after a prior step 2 draft marker", () => {
  const prior = buildDueFollowUpDraftPatch({
    thread: baseThread(),
    settings: { auto_follow_up_only: true },
    now,
  });
  assert.equal(prior.ok, true);

  const result = buildDueFollowUpDraftPatch({
    thread: baseThread({
      status: "sent",
      notes: prior.patch.notes,
      next_follow_up_at: "2026-06-30T09:00:00.000Z",
    }),
    settings: { auto_follow_up_only: true },
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.step, 3);
  assert.equal(result.patch.body, "Follow-up two");
});

test("does not duplicate a pending draft for the same step", () => {
  const first = buildDueFollowUpDraftPatch({
    thread: baseThread(),
    settings: { auto_follow_up_only: true },
    now,
  });
  assert.equal(first.ok, true);

  const duplicate = buildDueFollowUpDraftPatch({
    thread: baseThread({ status: "follow_up_due", notes: first.patch.notes }),
    settings: { auto_follow_up_only: true },
    now,
  });

  assert.deepEqual(duplicate, { ok: false, reason: "draft_already_pending" });
});

test("latestFollowUpDraftState reads the last marker", () => {
  const first = buildDueFollowUpDraftPatch({
    thread: baseThread(),
    settings: { auto_follow_up_only: true },
    now,
  });
  assert.equal(first.ok, true);

  assert.equal(latestFollowUpDraftState(first.patch.notes).step, 2);
});

test("summarizes follow-up draft run outcomes", () => {
  const summary = buildFollowUpDraftRunSummary([
    { status: "drafted" },
    { status: "skipped", reason: "not_due" },
    { status: "failed", reason: "db_error" },
  ]);

  assert.deepEqual(summary, {
    scanned: 3,
    drafted: 1,
    skipped: 1,
    failed: 1,
    reasons: { not_due: 1, db_error: 1 },
  });
});

test("follow-up draft run summary records run time for persisted observability", () => {
  const summary = buildFollowUpDraftRunSummary([
    { status: "drafted" },
    { status: "drafted" },
    { status: "skipped", reason: "not_due" },
  ], { now });

  assert.deepEqual(summary, {
    last_run_at: "2026-06-30T10:00:00.000Z",
    scanned: 3,
    drafted: 2,
    skipped: 1,
    failed: 0,
    reasons: { not_due: 1 },
  });
});
