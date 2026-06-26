import test from "node:test";
import assert from "node:assert/strict";
import { buildInboxQueue, mergeInboxThreadsWithDueFollowUps } from "./web/lib/inbox-agent.mjs";

test("merges due outreach threads without duplicating synced candidate replies", () => {
  const merged = mergeInboxThreadsWithDueFollowUps({
    now: new Date("2026-06-26T10:00:00.000Z"),
    inboxThreads: [
      {
        id: "inbox-1",
        outreach_thread_id: "thread-with-reply",
        candidate_name: "Grace",
        gmail_thread_id: "gmail-1",
        classification: "interested",
      },
    ],
    outreachThreads: [
      {
        id: "thread-with-reply",
        candidate_name: "Grace",
        gmail_thread_id: "gmail-1",
        status: "sent",
        next_follow_up_at: "2026-06-25T10:00:00.000Z",
      },
      {
        id: "thread-due",
        candidate_name: "Ada",
        gmail_thread_id: "gmail-2",
        status: "sent",
        next_follow_up_at: "2026-06-25T10:00:00.000Z",
        sequence_messages: [{ step: 2, body: "Hi Ada, quick follow-up." }],
      },
      {
        id: "thread-future",
        candidate_name: "Lin",
        gmail_thread_id: "gmail-3",
        status: "sent",
        next_follow_up_at: "2026-06-28T10:00:00.000Z",
      },
      {
        id: "thread-stopped",
        candidate_name: "Kim",
        gmail_thread_id: "gmail-4",
        status: "stopped",
        next_follow_up_at: "2026-06-25T10:00:00.000Z",
      },
      {
        id: "thread-no-gmail",
        candidate_name: "No Gmail",
        status: "follow_up_due",
      },
    ],
  });

  assert.deepEqual(merged.map((thread) => thread.id), ["inbox-1", "followup-thread-due"]);
  assert.equal(merged[1].classification, "no_reply_follow_up");
  assert.equal(merged[1].outreach_thread_id, "thread-due");
  assert.equal(merged[1].gmail_thread_id, "gmail-2");
});

test("includes explicit follow_up_due threads even when follow-up timestamp is absent", () => {
  const merged = mergeInboxThreadsWithDueFollowUps({
    now: new Date("2026-06-26T10:00:00.000Z"),
    inboxThreads: [],
    outreachThreads: [
      {
        id: "thread-due",
        candidate_name: "Ada",
        gmail_thread_id: "gmail-2",
        status: "follow_up_due",
      },
    ],
  });

  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "followup-thread-due");
  assert.equal(merged[0].classification, "no_reply_follow_up");
});

test("treats due scheduled follow-up threads as pending actionable drafts", () => {
  const merged = mergeInboxThreadsWithDueFollowUps({
    now: new Date("2026-06-26T10:00:00.000Z"),
    inboxThreads: [],
    outreachThreads: [
      {
        id: "thread-scheduled",
        candidate_name: "Ada",
        gmail_thread_id: "gmail-2",
        status: "follow_up_scheduled",
        next_follow_up_at: "2026-06-25T10:00:00.000Z",
        sequence_messages: [{ step: 2, body: "Hi Ada, quick follow-up." }],
      },
    ],
  });
  const queue = buildInboxQueue({ threads: merged });

  assert.equal(queue.summary.due_follow_up, 1);
  assert.equal(queue.items[0].next_action, "save_follow_up_draft");
  assert.equal(queue.items[0].action_status, "pending");
});

test("treats follow_up_later threads as due when reminder time arrives", () => {
  const merged = mergeInboxThreadsWithDueFollowUps({
    now: new Date("2026-06-26T10:00:00.000Z"),
    inboxThreads: [],
    outreachThreads: [
      {
        id: "thread-later",
        candidate_name: "Ada",
        gmail_thread_id: "gmail-2",
        status: "follow_up_later",
        next_follow_up_at: "2026-06-25T10:00:00.000Z",
        sequence_messages: [{ step: 2, body: "Hi Ada, quick follow-up." }],
      },
    ],
  });
  const queue = buildInboxQueue({ threads: merged });

  assert.equal(merged[0].classification, "no_reply_follow_up");
  assert.equal(queue.summary.due_follow_up, 1);
  assert.equal(queue.items[0].next_action, "save_follow_up_draft");
});
