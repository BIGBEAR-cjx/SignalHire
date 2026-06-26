import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInboxQueue,
  classifyInboxReply,
  shouldStopFollowUp,
} from "./web/lib/inbox-agent.mjs";
import { mergeInboxActionNotes } from "./web/lib/inbox-actions.mjs";

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
  assert.equal(queue.summary.needs_scheduling, 1);
  assert.equal(queue.summary.needs_reply, 1);
  assert.deepEqual(queue.items.map((item) => [item.candidate_name, item.next_action, item.action_label]), [
    ["Ada", "schedule", "Prepare scheduling handoff"],
    ["Grace", "reply", "Reply with role details"],
    ["Lin", "stop", "Stop follow-up"],
  ]);
  assert.deepEqual(queue.interested_candidates.map((item) => [item.candidate_name, item.readiness]), [
    ["Ada", "needs_scheduling"],
  ]);
  assert.deepEqual(queue.items.map((item) => item.classification), ["interested", "ask_for_details", "not_interested"]);
  assert.deepEqual(queue.items.map((item) => item.action_status), ["pending", "pending", "pending"]);
});

test("builds inbox action status from outreach metadata and status", () => {
  const queue = buildInboxQueue({
    threads: [
      {
        id: "1",
        candidate_name: "Ada",
        classification: "interested",
        action_notes: '<!--signalhire-inbox-action:%7B%22action%22%3A%22schedule%22%2C%22action_status%22%3A%22interview_ready%22%2C%22action_applied_at%22%3A%222026-06-26T10%3A00%3A00.000Z%22%7D-->',
      },
      { id: "2", candidate_name: "Grace", classification: "not_interested", outreach_status: "stopped" },
    ],
  });

  assert.equal(queue.items[0].action_status, "interview_ready");
  assert.equal(queue.items[1].action_status, "stopped");
  assert.equal(queue.summary.needs_scheduling, 0);
  assert.equal(queue.summary.stopped, 1);
});

test("maps later, out of office, and unclear replies to action-first queue states", () => {
  const queue = buildInboxQueue({
    threads: [
      { id: "1", candidate_name: "Later", classification: "later", suggested_reply: "I can follow up later." },
      { id: "2", candidate_name: "OOO", classification: "out_of_office" },
      { id: "3", candidate_name: "Review", classification: "needs_human_reply", suggested_reply: "Review first." },
    ],
  });

  assert.deepEqual(queue.items.map((item) => [item.next_action, item.priority]), [
    ["follow_up_later", "medium"],
    ["follow_up_later", "medium"],
    ["review", "medium"],
  ]);
  assert.equal(queue.items[2].reply_draft, "Review first.");
});

test("adds scheduling handoff packet for interested candidates", () => {
  const queue = buildInboxQueue({
    threads: [
      {
        id: "1",
        candidate_name: "Ada",
        classification: "interested",
        classification_reason: "Matched reply phrase: happy to chat",
        last_message_excerpt: "Happy to chat next week.",
        candidate_snapshot: {
          strongest_evidence: ["Built vLLM inference service"],
          risk_flags: ["Current availability unknown"],
          evidence_audit: { unverified_claims: ["Compensation expectations"] },
        },
      },
    ],
  });

  assert.equal(queue.interested_candidates[0].scheduling_packet.candidate_summary, "Ada replied with interest.");
  assert.equal(queue.interested_candidates[0].scheduling_packet.reply_excerpt, "Happy to chat next week.");
  assert.match(queue.interested_candidates[0].scheduling_packet.suggested_scheduling_message, /2-3 time windows/i);
  assert.deepEqual(queue.interested_candidates[0].scheduling_packet.interview_questions, [
    "What work are you most interested in discussing for this role?",
    "Which recent project best represents your fit for this team?",
    "What timing and process would make an interview worthwhile?",
  ]);
  assert.deepEqual(queue.interested_candidates[0].scheduling_packet.strongest_evidence, ["Built vLLM inference service"]);
  assert.deepEqual(queue.interested_candidates[0].scheduling_packet.risk_flags, ["Current availability unknown"]);
  assert.deepEqual(queue.interested_candidates[0].scheduling_packet.unverified_claims, ["Compensation expectations"]);
  assert.equal(queue.interested_candidates[0].scheduling_packet.claim_status_summary, "Verified evidence and unverified claims are separated for hiring review.");
  assert.match(queue.interested_candidates[0].scheduling_packet.candidate_reply, /2-3 time windows/i);
  assert.match(queue.interested_candidates[0].scheduling_packet.candidate_reply, /Happy to chat next week/i);
  assert.doesNotMatch(queue.interested_candidates[0].scheduling_packet.candidate_reply, /calendar invite|already scheduled/i);
  assert.equal(queue.interested_candidates[0].scheduling_packet.handoff_title, "Interview-ready handoff for Ada");
  assert.match(queue.interested_candidates[0].scheduling_packet.hiring_manager_note, /Built vLLM inference service/);
  assert.match(queue.interested_candidates[0].scheduling_packet.verified_summary, /Built vLLM inference service/);
  assert.match(queue.interested_candidates[0].scheduling_packet.risk_summary, /Current availability unknown/);
});

test("interview-ready action state is excluded from needs scheduling", () => {
  const queue = buildInboxQueue({
    threads: [
      {
        id: "1",
        candidate_name: "Ada",
        classification: "interested",
        notes: mergeInboxActionNotes("", {
          action: "schedule",
          action_status: "interview_ready",
          action_applied_at: "2026-06-26T10:00:00.000Z",
          scheduling_message: "Candidate reply",
        }),
      },
      {
        id: "2",
        candidate_name: "Grace",
        classification: "interested",
      },
    ],
  });
  const ada = queue.interested_candidates.find((candidate) => candidate.candidate_name === "Ada");
  const grace = queue.interested_candidates.find((candidate) => candidate.candidate_name === "Grace");

  assert.equal(queue.summary.interested, 2);
  assert.equal(queue.summary.needs_scheduling, 1);
  assert.equal(grace.action_status, "pending");
  assert.equal(ada.action_status, "interview_ready");
});

test("builds no-reply due follow-up draft from sequence messages", () => {
  const queue = buildInboxQueue({
    threads: [
      {
        id: "followup-thread-1",
        candidate_name: "Ada",
        classification: "no_reply_follow_up",
        sequence_messages: [
          { step: 1, body: "Initial note" },
          {
            step: 2,
            body: "Hi Ada, quick follow-up because your vLLM inference work looked especially relevant.",
          },
        ],
        candidate_snapshot: {
          strongest_evidence: ["Built vLLM inference service"],
        },
        updated_at: "2026-06-26T10:00:00.000Z",
        outreach_thread_id: "thread-1",
        gmail_thread_id: "gmail-1",
      },
    ],
  });

  assert.equal(queue.summary.due_follow_up, 1);
  assert.equal(queue.summary.needs_reply, 0);
  assert.equal(queue.interested_candidates.length, 0);
  assert.equal(queue.items[0].classification, "no_reply_follow_up");
  assert.equal(queue.items[0].next_action, "save_follow_up_draft");
  assert.equal(queue.items[0].action_label, "Save follow-up draft");
  assert.equal(queue.items[0].reply_draft, "Hi Ada, quick follow-up because your vLLM inference work looked especially relevant.");
  assert.doesNotMatch(queue.items[0].reply_draft, /thanks for (your|the) reply/i);
});

test("today queue prioritizes scheduling and replies before due follow-up and review", () => {
  const queue = buildInboxQueue({
    threads: [
      { id: "followup", candidate_name: "Follow", classification: "no_reply_follow_up", updated_at: "2026-06-26T10:00:00.000Z" },
      { id: "review", candidate_name: "Review", classification: "needs_human_reply", updated_at: "2026-06-26T11:00:00.000Z" },
      { id: "stop", candidate_name: "Stop", classification: "bounced", updated_at: "2026-06-26T12:00:00.000Z" },
      { id: "reply", candidate_name: "Reply", classification: "ask_for_details", updated_at: "2026-06-26T13:00:00.000Z" },
      { id: "schedule", candidate_name: "Schedule", classification: "interested", updated_at: "2026-06-26T14:00:00.000Z" },
    ],
  });

  assert.deepEqual(queue.today_queue.map((item) => [item.id, item.today_rank, item.next_action]), [
    ["schedule", 1, "schedule"],
    ["reply", 2, "reply"],
    ["followup", 3, "save_follow_up_draft"],
    ["review", 4, "review"],
  ]);
  assert.equal(queue.today_queue.some((item) => item.id === "stop"), false);
  assert.match(queue.today_queue[0].today_reason, /Schedule|scheduling|约面/i);
});
