import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInboxActionPatch,
  mergeInboxActionNotes,
  parseInboxActionState,
} from "./web/lib/inbox-actions.mjs";
import { runInboxAction } from "./web/lib/inbox-actions-route.mjs";

test("stores and reads inbox action metadata without losing human notes", () => {
  const state = {
    action: "reply",
    action_status: "draft_saved",
    action_applied_at: "2026-06-26T10:00:00.000Z",
    reply_draft: "Hi Ada...",
  };
  const notes = mergeInboxActionNotes("Human note", state);

  assert.match(notes, /Human note/);
  assert.deepEqual(parseInboxActionState(notes), {
    action: "reply",
    action_status: "draft_saved",
    action_applied_at: "2026-06-26T10:00:00.000Z",
    reply_draft: "Hi Ada...",
    follow_up_at: "",
    scheduling_message: "",
  });
});

test("maps inbox actions to outreach thread patches", () => {
  const now = new Date("2026-06-26T10:00:00.000Z");

  assert.equal(buildInboxActionPatch({ action: "bad", now }).ok, false);
  assert.deepEqual(buildInboxActionPatch({ action: "schedule", now }).patch.status, "replied");
  assert.deepEqual(buildInboxActionPatch({ action: "reply", reply_draft: "Draft", now }).patch.body, "Draft");
  assert.equal(buildInboxActionPatch({ action: "follow_up_later", now }).patch.status, "follow_up_scheduled");
  assert.match(buildInboxActionPatch({ action: "follow_up_later", now }).patch.next_follow_up_at, /^2026-07-03T10:00:00/);
  assert.equal(buildInboxActionPatch({ action: "stop", now }).patch.status, "stopped");
  assert.equal(buildInboxActionPatch({ action: "review", now }).action_state.action_status, "reviewed");
});

test("schedule action persists scheduling message as interview-ready state", () => {
  const now = new Date("2026-06-26T10:00:00.000Z");
  const result = buildInboxActionPatch({
    action: "schedule",
    scheduling_message: "Hi Ada, could you share 2-3 time windows?",
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.patch.status, "replied");
  assert.equal(result.action_state.action_status, "interview_ready");
  assert.equal(result.action_state.scheduling_message, "Hi Ada, could you share 2-3 time windows?");
});

test("save follow-up draft persists body without sending", () => {
  const now = new Date("2026-06-26T10:00:00.000Z");
  const result = buildInboxActionPatch({
    action: "save_follow_up_draft",
    reply_draft: "Hi Ada, quick follow-up because your vLLM work looked relevant.",
    now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.patch.status, "follow_up_due");
  assert.equal(result.patch.body, "Hi Ada, quick follow-up because your vLLM work looked relevant.");
  assert.equal(result.patch.sent_at, undefined);
  assert.equal(result.action_state.action_status, "draft_saved");
  assert.equal(result.action_state.reply_draft, "Hi Ada, quick follow-up because your vLLM work looked relevant.");
});

test("runInboxAction saves follow-up draft through the authorized outreach thread", async () => {
  const calls = [];
  const deps = {
    user: { id: "user-1" },
    getOutreachThread: async (input) => {
      calls.push(["get", input]);
      return { id: input.id, user_id: input.userId, notes: "Existing" };
    },
    updateOutreachThread: async (input) => {
      calls.push(["update", input]);
      return { id: input.id, status: input.status, body: input.body, notes: input.notes };
    },
    now: new Date("2026-06-26T10:00:00.000Z"),
  };

  const result = await runInboxAction({
    body: {
      outreach_thread_id: "t1",
      action: "save_follow_up_draft",
      reply_draft: "Follow-up draft",
    },
    ...deps,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.action_state.action_status, "draft_saved");
  assert.equal(calls.at(-1)[1].status, "follow_up_due");
  assert.equal(calls.at(-1)[1].body, "Follow-up draft");
});

test("runInboxAction checks auth, ownership lookup, invalid action, and update", async () => {
  const calls = [];
  const deps = {
    user: { id: "user-1" },
    getOutreachThread: async (input) => {
      calls.push(["get", input]);
      return { id: input.id, user_id: input.userId, notes: "Existing" };
    },
    updateOutreachThread: async (input) => {
      calls.push(["update", input]);
      return { id: input.id, status: input.status, notes: input.notes };
    },
    now: new Date("2026-06-26T10:00:00.000Z"),
  };

  assert.equal((await runInboxAction({ body: {}, ...deps, user: null })).status, 401);
  assert.equal((await runInboxAction({ body: {}, ...deps })).status, 400);
  assert.equal((await runInboxAction({ body: { outreach_thread_id: "t1", action: "bad" }, ...deps })).status, 400);

  const result = await runInboxAction({
    body: { outreach_thread_id: "t1", action: "reply", reply_draft: "Draft" },
    ...deps,
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.action_state.action_status, "draft_saved");
  assert.deepEqual(calls[0], ["get", { userId: "user-1", id: "t1" }]);
  assert.equal(calls.at(-1)[1].userId, "user-1");
  assert.equal(calls.at(-1)[1].status, "replied");
  assert.equal(calls.at(-1)[1].body, "Draft");
});
