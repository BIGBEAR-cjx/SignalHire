import test from "node:test";
import assert from "node:assert/strict";
import { syncGmailInboxForProjectCore } from "./web/lib/inbox-sync-core.mjs";

function baseDeps(overrides = {}) {
  return {
    getGmailConnectionStatus: async () => ({
      connected: true,
      can_read_inbox: true,
      gmail_address: "recruiter@example.com",
    }),
    listRoleRelatedOutreachThreads: async () => [],
    getGmailThreadMessages: async () => [],
    saveInboxThread: async () => ({ id: "inbox-1" }),
    updateOutreachThread: async () => ({}),
    now: new Date("2026-06-26T10:00:00.000Z"),
    ...overrides,
  };
}

test("gmail sync returns structured skipped summary when disconnected or readonly is missing", async () => {
  const disconnected = await syncGmailInboxForProjectCore({
    userId: "u1",
    projectId: "p1",
    ...baseDeps({
      getGmailConnectionStatus: async () => ({
        connected: false,
        can_read_inbox: false,
        gmail_address: "",
      }),
    }),
  });
  assert.deepEqual(disconnected, {
    ok: false,
    connected: false,
    can_read_inbox: false,
    synced: 0,
    scanned: 0,
    skipped_reason: "gmail_not_connected",
    last_synced_at: "2026-06-26T10:00:00.000Z",
    errors: [],
  });

  const missingScope = await syncGmailInboxForProjectCore({
    userId: "u1",
    projectId: "p1",
    ...baseDeps({
      getGmailConnectionStatus: async () => ({
        connected: true,
        can_read_inbox: false,
        gmail_address: "recruiter@example.com",
      }),
    }),
  });
  assert.equal(missingScope.skipped_reason, "gmail_readonly_scope_missing");
  assert.equal(missingScope.connected, true);
  assert.equal(missingScope.can_read_inbox, false);
});

test("gmail sync maps candidate replies to outreach statuses and action markers", async () => {
  const updates = [];
  const savedClassifications = [];
  const threads = [
    { id: "t1", candidate_name: "Interested", gmail_thread_id: "g1", notes: "", role_brief: "AI role" },
    { id: "t2", candidate_name: "Details", gmail_thread_id: "g2", notes: "", role_brief: "AI role" },
    { id: "t3", candidate_name: "Later", gmail_thread_id: "g3", notes: "", role_brief: "AI role" },
    { id: "t4", candidate_name: "OOO", gmail_thread_id: "g4", notes: "", role_brief: "AI role" },
    { id: "t5", candidate_name: "Stop", gmail_thread_id: "g5", notes: "", role_brief: "AI role" },
    { id: "t6", candidate_name: "Bounce", gmail_thread_id: "g6", notes: "", role_brief: "AI role" },
  ];
  const messages = {
    g1: "Happy to chat next week.",
    g2: "Can you share more details about the team?",
    g3: "Please circle back next month.",
    g4: "I am out of office until Monday.",
    g5: "Not interested, no thanks.",
    g6: "Delivery Status Notification: bounced.",
  };

  const result = await syncGmailInboxForProjectCore({
    userId: "u1",
    projectId: "p1",
    roleBrief: "AI role",
    ...baseDeps({
      listRoleRelatedOutreachThreads: async () => threads,
      getGmailThreadMessages: async ({ threadId }) => [
        { id: `${threadId}-m1`, threadId, from: "Candidate <candidate@example.com>", snippet: messages[threadId], bodyText: messages[threadId] },
      ],
      saveInboxThread: async ({ classification }) => {
        savedClassifications.push(classification.classification);
        return { id: `inbox-${savedClassifications.length}` };
      },
      updateOutreachThread: async (patch) => {
        updates.push(patch);
        return patch;
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.scanned, 6);
  assert.equal(result.synced, 6);
  assert.equal(result.connected, true);
  assert.equal(result.can_read_inbox, true);
  assert.equal(result.last_synced_at, "2026-06-26T10:00:00.000Z");
  assert.deepEqual(savedClassifications, [
    "interested",
    "ask_for_details",
    "later",
    "out_of_office",
    "not_interested",
    "bounced",
  ]);
  assert.deepEqual(updates.map((patch) => [patch.id, patch.status]), [
    ["t1", "replied"],
    ["t2", "needs_reply"],
    ["t3", "follow_up_later"],
    ["t4", "follow_up_later"],
    ["t5", "stopped"],
    ["t6", "bounced"],
  ]);
  assert.ok(updates.slice(1).every((patch) => /signalhire-inbox-action/.test(patch.notes)));
});

test("gmail reconnect required is returned as top-level sync skipped reason", async () => {
  const result = await syncGmailInboxForProjectCore({
    userId: "u1",
    projectId: "p1",
    ...baseDeps({
      listRoleRelatedOutreachThreads: async () => [
        { id: "t1", candidate_name: "Ada", gmail_thread_id: "g1", notes: "", role_brief: "AI role" },
      ],
      getGmailThreadMessages: async () => {
        throw new Error("gmail_reconnect_required");
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.scanned, 1);
  assert.equal(result.synced, 0);
  assert.equal(result.skipped_reason, "gmail_reconnect_required");
  assert.equal(result.errors[0].error, "gmail_reconnect_required");
});
