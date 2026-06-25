import test from "node:test";
import assert from "node:assert/strict";
import {
  OUTREACH_THREAD_STATUSES,
  buildOutreachQueue,
  buildOutreachThreadDraft,
  normalizeOutreachThreadPatch,
} from "./web/lib/outreach-threads.mjs";

test("defines recruiting follow-up statuses with controlled Gmail sending", () => {
  assert.deepEqual(OUTREACH_THREAD_STATUSES, [
    "drafted",
    "approved",
    "sent",
    "follow_up_scheduled",
    "contacted",
    "follow_up_due",
    "replied",
    "bounced",
    "stopped",
    "interviewing",
    "rejected",
    "hired",
  ]);
});

test("builds a persisted outreach draft payload from an AI draft", () => {
  const draft = buildOutreachThreadDraft({
    candidate: { name: "Ada Lovelace", strongest_signals: ["Merged vLLM PRs"] },
    shortlistItemId: "short-1",
    projectId: "project-1",
    tone: "short",
    roleBrief: "Senior LLM inference engineer",
    generatedDraft: { subject: "Agent infra role", body: "Hi Ada..." },
  });

  assert.equal(draft.candidate_name, "Ada Lovelace");
  assert.equal(draft.status, "drafted");
  assert.equal(draft.subject, "Agent infra role");
  assert.equal(draft.body, "Hi Ada...");
  assert.equal(draft.tone, "short");
  assert.equal(draft.project_id, "project-1");
  assert.equal(draft.shortlist_item_id, "short-1");
});

test("builds an outreach thread that can immediately enter the follow-up queue", () => {
  const draft = buildOutreachThreadDraft({
    candidate: { name: "Ada Lovelace" },
    generatedDraft: { subject: "Agent infra role", body: "Hi Ada..." },
    status: "contacted",
    nextFollowUpAt: "2026-06-20T10:00:00.000Z",
    now: new Date("2026-06-15T10:00:00.000Z"),
  });

  assert.equal(draft.status, "contacted");
  assert.equal(draft.last_contacted_at, "2026-06-15T10:00:00.000Z");
  assert.equal(draft.next_follow_up_at, "2026-06-20T10:00:00.000Z");
});

test("normalizes outreach patches and converts contacted without a date to now", () => {
  const patch = normalizeOutreachThreadPatch({
    status: "contacted",
    subject: "  Hello  ",
    body: "  Body  ",
    next_follow_up_at: "2026-06-20T10:00:00.000Z",
  }, { now: new Date("2026-06-15T10:00:00.000Z") });

  assert.equal(patch.status, "contacted");
  assert.equal(patch.subject, "Hello");
  assert.equal(patch.body, "Body");
  assert.equal(patch.last_contacted_at, "2026-06-15T10:00:00.000Z");
  assert.equal(patch.next_follow_up_at, "2026-06-20T10:00:00.000Z");
});

test("builds an action-first outreach queue with due follow-ups first", () => {
  const queue = buildOutreachQueue({
    threads: [
      { id: "future", status: "contacted", candidate_name: "Future", next_follow_up_at: "2026-06-18T10:00:00.000Z", updated_at: "2026-06-15T09:00:00.000Z" },
      { id: "draft", status: "drafted", candidate_name: "Draft", next_follow_up_at: null, updated_at: "2026-06-15T11:00:00.000Z" },
      { id: "due", status: "contacted", candidate_name: "Due", next_follow_up_at: "2026-06-14T10:00:00.000Z", updated_at: "2026-06-15T08:00:00.000Z" },
    ],
    now: new Date("2026-06-15T10:00:00.000Z"),
  });

  assert.deepEqual(queue.summary, { due: 1, drafted: 1, active: 3 });
  assert.deepEqual(queue.items.map((item) => [item.id, item.queue_state]), [
    ["due", "due"],
    ["draft", "draft"],
    ["future", "scheduled"],
  ]);
});
