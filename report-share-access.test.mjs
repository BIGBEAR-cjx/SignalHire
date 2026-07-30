import test from "node:test";
import assert from "node:assert/strict";
import {
  buildClientDeliveryShareHref,
  buildClientDeliveryShareToken,
  canSubmitAccountFeedback,
  normalizeClientDeliveryAccessPolicy,
  requiresClientDeliveryShareToken,
  verifyClientDeliveryShareAccess,
} from "./web/lib/report-share-access.mjs";

const projectRun = {
  id: "run-123",
  kind: "search",
  user_id: "user-1",
  project_id: "project-1",
  updated_at: "2026-07-03T12:00:00.000Z",
};

test("client delivery share token is deterministic and scoped to run owner project and version", () => {
  const token = buildClientDeliveryShareToken(projectRun, { secret: "test-secret" });

  assert.equal(requiresClientDeliveryShareToken(projectRun), true);
  assert.equal(token, buildClientDeliveryShareToken(projectRun, { secret: "test-secret" }));
  assert.notEqual(token, buildClientDeliveryShareToken({ ...projectRun, updated_at: "2026-07-04T12:00:00.000Z" }, { secret: "test-secret" }));
  assert.match(token, /^[A-Za-z0-9_-]{32,}$/);
});

test("client delivery share access allows legacy non-project reports but rejects missing or wrong project tokens", () => {
  const token = buildClientDeliveryShareToken(projectRun, { secret: "test-secret" });

  assert.equal(verifyClientDeliveryShareAccess(projectRun, token, { secret: "test-secret" }).allowed, true);
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", { secret: "test-secret" }).allowed, false);
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "wrong-token", { secret: "test-secret" }).reason, "invalid_share_token");
  assert.equal(verifyClientDeliveryShareAccess({ ...projectRun, project_id: null }, "", { secret: "test-secret" }).allowed, true);
});

test("client delivery report href includes share token only when project-bound report needs it", () => {
  const href = buildClientDeliveryShareHref(projectRun, { secret: "test-secret", locale: "en" });

  assert.match(href, /^\/r\/run-123\?lang=en&t=/);
  assert.equal(buildClientDeliveryShareHref({ ...projectRun, project_id: null }, { secret: "test-secret" }), "/r/run-123");
});

test("client delivery access policy allows invited customer accounts without weakening token access", () => {
  const policy = normalizeClientDeliveryAccessPolicy({
    mode: "token_or_customer_account",
    allowed_emails: ["client@example.com", "CLIENT@example.com"],
    allowed_domains: ["example.org"],
  });

  assert.deepEqual(policy, {
    mode: "token_or_customer_account",
    allowed_emails: ["client@example.com"],
    allowed_domains: ["example.org"],
    invites: [],
  });
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", {
    secret: "test-secret",
    viewer: { id: "customer-1", email: "client@example.com" },
    accessPolicy: policy,
  }).reason, "valid_customer_account");
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", {
    secret: "test-secret",
    viewer: { id: "customer-2", email: "buyer@example.org" },
    accessPolicy: policy,
  }).allowed, true);
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", {
    secret: "test-secret",
    viewer: { id: "customer-3", email: "outsider@example.net" },
    accessPolicy: policy,
  }).allowed, false);
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "wrong-token", {
    secret: "test-secret",
    viewer: { id: "customer-1", email: "client@example.com" },
    accessPolicy: policy,
  }).reason, "valid_customer_account");
});

test("client delivery account invites grant access only while active", () => {
  const policy = normalizeClientDeliveryAccessPolicy({
    mode: "token_or_customer_account",
    allowed_emails: ["owner@client.ai"],
    invites: [
      {
        email: "Active@Client.ai",
        status: "active",
        invited_at: "2026-07-01T10:00:00.000Z",
        last_sent_at: "2026-07-02T10:00:00.000Z",
        expires_at: "2026-08-01T00:00:00.000Z",
      },
      {
        email: "revoked@client.ai",
        status: "revoked",
        invited_at: "2026-07-01T10:00:00.000Z",
        revoked_at: "2026-07-03T10:00:00.000Z",
      },
      {
        email: "expired@client.ai",
        status: "active",
        invited_at: "2026-06-01T10:00:00.000Z",
        expires_at: "2026-07-01T00:00:00.000Z",
      },
    ],
  }, { now: "2026-07-05T00:00:00.000Z" });

  assert.deepEqual(policy.allowed_emails, ["owner@client.ai", "active@client.ai"]);
  assert.deepEqual(policy.invites.map((item) => ({ email: item.email, status: item.status })), [
    { email: "active@client.ai", status: "active" },
    { email: "revoked@client.ai", status: "revoked" },
    { email: "expired@client.ai", status: "expired" },
  ]);
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", {
    secret: "test-secret",
    viewer: { id: "customer-4", email: "active@client.ai" },
    accessPolicy: policy,
  }).reason, "valid_customer_account");
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", {
    secret: "test-secret",
    viewer: { id: "customer-5", email: "revoked@client.ai" },
    accessPolicy: policy,
  }).reason, "missing_share_token");
  assert.equal(verifyClientDeliveryShareAccess(projectRun, "", {
    secret: "test-secret",
    viewer: { id: "customer-6", email: "expired@client.ai" },
    accessPolicy: policy,
  }).reason, "missing_share_token");
});

test("account-authorized report viewers can submit feedback without a share token", () => {
  assert.equal(canSubmitAccountFeedback({ authorized: true, token: "" }), true);
  assert.equal(canSubmitAccountFeedback({ authorized: false, token: "" }), false);
});
