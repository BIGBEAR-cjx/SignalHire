import test from "node:test";
import assert from "node:assert/strict";
import { buildTwoSidedMessageHistory } from "./web/lib/message-history.mjs";
import { mergeInboxActionNotes } from "./web/lib/inbox-actions.mjs";

test("builds two-sided message history from outreach, inbox, and Gmail messages", () => {
  const history = buildTwoSidedMessageHistory({
    outreachThread: {
      id: "thread-1",
      subject: "AI Engineer role",
      body: "Hi Ada, your vLLM work looked relevant.",
      sent_at: "2026-07-01T10:00:00.000Z",
      gmail_message_id: "m-outbound",
    },
    inboxThread: {
      gmail_message_id: "m-reply",
      last_message_excerpt: "Interested, happy to chat next week.",
      updated_at: "2026-07-02T09:00:00.000Z",
    },
    gmailMessages: [
      { id: "m-outbound", from: "recruiter@signalhire.ai", date: "Tue, 01 Jul 2026 10:00:00 GMT", bodyText: "Hi Ada, your vLLM work looked relevant." },
      { id: "m-reply", from: "Ada <ada@example.com>", date: "Wed, 02 Jul 2026 09:00:00 GMT", bodyText: "Interested, happy to chat next week." },
    ],
    actorEmail: "recruiter@signalhire.ai",
  });

  assert.deepEqual(history.summary, { outbound: 1, inbound: 1, system: 0, total: 2 });
  assert.deepEqual(history.messages.map((message) => message.direction), ["outbound", "inbound"]);
  assert.equal(history.messages[0].body, "Hi Ada, your vLLM work looked relevant.");
  assert.equal(history.messages[1].body, "Interested, happy to chat next week.");
});

test("deduplicates message history and falls back to saved drafts", () => {
  const history = buildTwoSidedMessageHistory({
    outreachThread: {
      id: "thread-1",
      body: "Saved reply draft",
      notes: "<!--signalhire-inbox-action:%7B%22action%22%3A%22reply%22%2C%22action_status%22%3A%22draft_saved%22%2C%22reply_draft%22%3A%22Saved reply draft%22%2C%22action_applied_at%22%3A%222026-07-02T10%3A00%3A00.000Z%22%7D-->",
      updated_at: "2026-07-02T10:00:00.000Z",
    },
    inboxThread: {
      gmail_message_id: "m-reply",
      last_message_excerpt: "Can you send details?",
      updated_at: "2026-07-02T09:00:00.000Z",
    },
    gmailMessages: [
      { id: "m-reply", from: "Ada <ada@example.com>", date: "Wed, 02 Jul 2026 09:00:00 GMT", bodyText: "Can you send details?" },
      { id: "m-reply", from: "Ada <ada@example.com>", date: "Wed, 02 Jul 2026 09:00:00 GMT", bodyText: "Can you send details?" },
    ],
    actorEmail: "recruiter@signalhire.ai",
  });

  assert.deepEqual(history.messages.map((message) => message.direction), ["inbound", "system"]);
  assert.equal(history.messages[1].status, "draft_saved");
  assert.equal(history.messages[1].body, "Saved reply draft");
});

test("merges persisted inbox action message events into two-sided history", () => {
  const notes = mergeInboxActionNotes("", {
    action: "schedule",
    action_status: "interview_ready",
    action_applied_at: "2026-07-02T10:00:00.000Z",
    scheduling_message: "Thanks Ada, here are two windows for next week.",
    message_history_events: [
      {
        id: "action-schedule-1",
        direction: "outbound",
        status: "draft_saved",
        subject: "AI Engineer role",
        body: "Thanks Ada, here are two windows for next week.",
        at: "2026-07-02T10:00:00.000Z",
        source: "inbox_action",
      },
    ],
  });
  const history = buildTwoSidedMessageHistory({
    outreachThread: {
      id: "thread-1",
      subject: "AI Engineer role",
      notes,
      updated_at: "2026-07-02T10:00:00.000Z",
    },
    inboxThread: {
      gmail_message_id: "m-reply",
      last_message_excerpt: "Happy to chat next week.",
      updated_at: "2026-07-02T09:00:00.000Z",
    },
  });

  assert.deepEqual(history.summary, { outbound: 1, inbound: 1, system: 0, total: 2 });
  assert.deepEqual(history.messages.map((message) => [message.source, message.direction]), [
    ["inbox_thread", "inbound"],
    ["inbox_action", "outbound"],
  ]);
  assert.equal(history.messages[1].status, "draft_saved");
  assert.equal(history.messages[1].body, "Thanks Ada, here are two windows for next week.");
});
