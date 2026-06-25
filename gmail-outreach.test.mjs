import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGmailAuthUrl,
  buildGmailRawMessage,
  decryptTokenBundle,
  encryptTokenBundle,
  validateOutreachSend,
} from "./web/lib/gmail-outreach.mjs";
import {
  buildOutreachSequenceMessages,
  buildOutreachThreadDraft,
  normalizeOutreachThreadPatch,
} from "./web/lib/outreach-threads.mjs";

test("token encryption round trips without leaking plain token text", () => {
  const key = "0123456789abcdef0123456789abcdef";
  const bundle = { access_token: "access", refresh_token: "refresh", expires_at: "2026-06-24T10:00:00.000Z" };
  const encrypted = encryptTokenBundle(bundle, key);

  assert.notEqual(encrypted, JSON.stringify(bundle));
  assert.deepEqual(decryptTokenBundle(encrypted, key), bundle);
});

test("gmail auth URL requests send and readonly without modify for P2a inbox sync", () => {
  const url = buildGmailAuthUrl({
    clientId: "client",
    redirectUri: "https://example.com/callback",
    state: "state-1",
  });

  assert.match(url, /scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.send/);
  assert.match(url, /gmail.readonly/);
  assert.doesNotMatch(url, /gmail.modify/);
  assert.match(url, /access_type=offline/);
});

test("sequence draft includes first email and follow-ups with evidence hooks", () => {
  const messages = buildOutreachSequenceMessages({
    subject: "Agent infra role",
    body: "Hi Ada, your vLLM work stood out.",
    candidate: {
      name: "Ada",
      strongest_signals: ["Merged vLLM PRs"],
      outreach_angle: "Mention inference work",
    },
  });

  assert.equal(messages.length, 3);
  assert.deepEqual(messages[0].evidence_hooks, ["Merged vLLM PRs", "Mention inference work"]);
  assert.equal(messages[0].step, 1);
  assert.match(messages[1].body, /Merged vLLM PRs|Mention inference work/);
});

test("send validation rejects draft, missing email, low confidence email, and disconnected Gmail", () => {
  const approved = buildOutreachThreadDraft({
    candidate: { name: "Ada", contact_profile: { emails: [{ value: "ada@example.ai", source: "internal_resume", confidence: "high" }] } },
    generatedDraft: { subject: "Hello", body: "Hi Ada" },
    status: "approved",
  });
  const draft = { ...approved, status: "drafted" };
  const low = buildOutreachThreadDraft({
    candidate: { name: "Ada", contact_profile: { emails: [{ value: "low@example.ai", source: "people_api", confidence: "low" }] } },
    generatedDraft: { subject: "Hello", body: "Hi Ada" },
    status: "approved",
  });

  assert.equal(validateOutreachSend({ thread: draft, gmailConnected: true }).ok, false);
  assert.equal(validateOutreachSend({ thread: { ...approved, contact_profile: { emails: [] } }, gmailConnected: true }).ok, false);
  assert.equal(validateOutreachSend({ thread: low, gmailConnected: true }).ok, false);
  assert.equal(validateOutreachSend({ thread: approved, gmailConnected: false }).ok, false);
  assert.equal(validateOutreachSend({ thread: approved, gmailConnected: true }).ok, true);
});

test("approved outreach can be converted to a Gmail raw message", () => {
  const raw = buildGmailRawMessage({
    from: "recruiter@example.com",
    to: "ada@example.ai",
    subject: "Agent infra role",
    body: "Hi Ada",
  });
  const decoded = Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

  assert.match(decoded, /To: ada@example.ai/);
  assert.match(decoded, /Subject: Agent infra role/);
  assert.match(decoded, /Hi Ada/);
});

test("approval and sent patches stamp lifecycle fields", () => {
  const approved = normalizeOutreachThreadPatch({ status: "approved" }, { now: new Date("2026-06-24T10:00:00.000Z") });
  const sent = normalizeOutreachThreadPatch({
    status: "sent",
    gmail_message_id: "msg-1",
    gmail_thread_id: "thread-1",
  }, { now: new Date("2026-06-24T11:00:00.000Z") });

  assert.equal(approved.approved_at, "2026-06-24T10:00:00.000Z");
  assert.equal(sent.sent_at, "2026-06-24T11:00:00.000Z");
  assert.equal(sent.gmail_message_id, "msg-1");
  assert.equal(sent.gmail_thread_id, "thread-1");
});
