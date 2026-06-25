import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInboxQueue,
  classifyInboxReply,
  shouldStopFollowUp,
} from "./web/lib/inbox-agent.mjs";

test("classifies interested replies with reason and excerpt", () => {
  const result = classifyInboxReply({
    text: "Thanks for reaching out. This looks interesting, happy to chat next week.",
    candidateName: "Ada",
  });

  assert.equal(result.classification, "interested");
  assert.match(result.classification_reason, /happy to chat|interesting/i);
  assert.match(result.last_message_excerpt, /happy to chat/);
  assert.equal(result.suggested_reply, "");
});

test("classifies ask for details and drafts a contextual reply", () => {
  const result = classifyInboxReply({
    text: "Can you share more details about compensation and the team?",
    candidateName: "Grace",
    roleBrief: "AI infra lead role for serving systems",
  });

  assert.equal(result.classification, "ask_for_details");
  assert.match(result.suggested_reply, /Grace/);
  assert.match(result.suggested_reply, /AI infra lead/);
});

test("classifies not interested, bounced, later, and out of office", () => {
  assert.equal(classifyInboxReply({ text: "Not interested, please stop contacting me." }).classification, "not_interested");
  assert.equal(classifyInboxReply({ text: "Delivery Status Notification: message bounced" }).classification, "bounced");
  assert.equal(classifyInboxReply({ text: "Circle back in September after planning." }).classification, "later");
  assert.equal(classifyInboxReply({ text: "I am out of office until Monday." }).classification, "out_of_office");
});

test("stops follow-up for not interested and bounced classifications", () => {
  assert.equal(shouldStopFollowUp("not_interested"), true);
  assert.equal(shouldStopFollowUp("bounced"), true);
  assert.equal(shouldStopFollowUp("interested"), false);
});

test("builds inbox and interested queues with interview-ready review candidates", () => {
  const queue = buildInboxQueue({
    threads: [
      { id: "1", candidate_name: "Ada", classification: "interested", last_message_excerpt: "Happy to chat", updated_at: "2026-06-24T10:00:00.000Z" },
      { id: "2", candidate_name: "Grace", classification: "ask_for_details", last_message_excerpt: "More details?", suggested_reply: "Hi Grace..." },
      { id: "3", candidate_name: "Lin", classification: "not_interested", last_message_excerpt: "No thanks" },
    ],
  });

  assert.equal(queue.summary.total, 3);
  assert.equal(queue.summary.interested, 1);
  assert.equal(queue.summary.needs_human_reply, 1);
  assert.deepEqual(queue.interested_candidates.map((item) => [item.candidate_name, item.readiness]), [
    ["Ada", "needs_scheduling"],
  ]);
  assert.deepEqual(queue.items.map((item) => item.classification), ["interested", "ask_for_details", "not_interested"]);
});
