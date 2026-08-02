import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientPortalInviteEmail,
  sendClientPortalInviteEmail,
  upsertClientDeliveryInvite,
} from "./web/lib/client-portal-invites.mjs";

test("upserts active client delivery invite into account access settings", () => {
  const settings = upsertClientDeliveryInvite({
    client_delivery_access: {
      mode: "token_only",
      allowed_emails: ["owner@client.ai"],
      allowed_domains: ["client.ai"],
      invites: [],
    },
  }, {
    email: "Hiring@Client.ai",
    now: "2026-07-05T10:00:00.000Z",
  });

  assert.equal(settings.client_delivery_access.mode, "token_or_customer_account");
  assert.deepEqual(settings.client_delivery_access.allowed_emails, ["owner@client.ai", "hiring@client.ai"]);
  assert.equal(settings.client_delivery_access.invites[0].email, "hiring@client.ai");
  assert.equal(settings.client_delivery_access.invites[0].status, "active");
  assert.equal(settings.client_delivery_access.invites[0].last_sent_at, "2026-07-05T10:00:00.000Z");
});

test("client portal invite email is blocked clearly when provider is not configured", async () => {
  const result = await sendClientPortalInviteEmail({
    email: "hiring@client.ai",
    projectName: "AI Infrastructure Lead",
    baseUrl: "https://signal-hire-eight.vercel.app",
    env: {},
  });

  assert.deepEqual(result, {
    status: "blocked",
    provider: "",
    error: "email_provider_not_configured",
  });
});

test("client portal invite email sends through Resend without internal fields", async () => {
  const requests = [];
  const result = await sendClientPortalInviteEmail({
    email: "hiring@client.ai",
    projectName: "AI Infrastructure Lead",
    baseUrl: "https://signal-hire-eight.vercel.app",
    allowedEmails: ["hiring@client.ai"],
    allowedDomains: ["client.ai"],
    env: {
      RESEND_API_KEY: "resend-secret",
      CLIENT_PORTAL_INVITE_FROM: "SignalHire <delivery@signalhire.ai>",
    },
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return { ok: true, json: async () => ({ id: "email-1" }) };
    },
  });

  assert.deepEqual(result, { status: "sent", provider: "resend", id: "email-1" });
  assert.equal(requests[0].url, "https://api.resend.com/emails");
  assert.equal(requests[0].init.headers.Authorization, "Bearer resend-secret");
  const body = JSON.parse(requests[0].init.body);
  assert.equal(body.to, "hiring@client.ai");
  assert.match(body.text, /\/register\?next=\/client/);
  assert.match(body.text, /hiring@client\.ai/);
  assert.doesNotMatch(body.text, /Authorized access|owner@client\.ai|domains:/);
  assert.doesNotMatch(JSON.stringify(body), /role_agent|execution_log|debug|internal/i);
});

test("client portal invite email send failures return a recoverable status", async () => {
  const result = await sendClientPortalInviteEmail({
    email: "hiring@client.ai",
    projectName: "AI Infrastructure Lead",
    baseUrl: "https://signal-hire-eight.vercel.app",
    env: {
      RESEND_API_KEY: "resend-secret",
      CLIENT_PORTAL_INVITE_FROM: "SignalHire <delivery@signalhire.ai>",
    },
    fetchImpl: async () => {
      throw new Error("network down");
    },
  });

  assert.deepEqual(result, { status: "failed", provider: "resend", error: "email_send_failed" });
});

test("client portal invite email copy includes workspace and verification path", () => {
  const email = buildClientPortalInviteEmail({
    email: "hiring@client.ai",
    projectName: "AI Infrastructure Lead",
    baseUrl: "https://signal-hire-eight.vercel.app",
    allowedEmails: ["hiring@client.ai"],
    allowedDomains: ["client.ai"],
  });

  assert.equal(email.to, "hiring@client.ai");
  assert.match(email.subject, /AI Infrastructure Lead/);
  assert.match(email.text, /\/client/);
  assert.match(email.text, /\/register\?next=\/client/);
});

test("client portal invite email falls back to the canonical public origin", () => {
  const email = buildClientPortalInviteEmail({
    email: "hiring@client.ai",
    projectName: "AI Infrastructure Lead",
  });

  assert.match(email.text, /https:\/\/evidenthire\.work\/register\?next=\/client/);
  assert.match(email.text, /https:\/\/evidenthire\.work\/client/);
});
