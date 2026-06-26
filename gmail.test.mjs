import test from "node:test";
import assert from "node:assert/strict";
import {
  buildGmailRefreshRequest,
  gmailReconnectRequired,
  refreshGmailTokenBundle,
  tokenBundleNeedsRefresh,
} from "./web/lib/gmail-token.mjs";

test("gmail token refresh uses refresh token and persists refreshed bundle data", async () => {
  const calls = [];
  const result = await refreshGmailTokenBundle({
    bundle: {
      access_token: "old-access",
      refresh_token: "refresh-1",
      expires_at: "2026-06-26T09:00:00.000Z",
      scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
    },
    clientId: "client-1",
    clientSecret: "secret-1",
    now: new Date("2026-06-26T10:00:00.000Z"),
    fetchImpl: async (url, init) => {
      calls.push({ url, body: String(init.body) });
      return {
        ok: true,
        json: async () => ({
          access_token: "new-access",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
        }),
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].body, /grant_type=refresh_token/);
  assert.match(calls[0].body, /refresh_token=refresh-1/);
  assert.equal(result.accessToken, "new-access");
  assert.equal(result.refreshed, true);
  assert.equal(result.bundle.access_token, "new-access");
  assert.equal(result.bundle.refresh_token, "refresh-1");
  assert.equal(result.bundle.expires_at, "2026-06-26T11:00:00.000Z");
});

test("gmail token helper reuses unexpired token and requires reconnect without refresh token", async () => {
  assert.equal(tokenBundleNeedsRefresh({
    access_token: "access",
    expires_at: "2026-06-26T10:10:00.000Z",
  }, new Date("2026-06-26T10:00:00.000Z")), false);

  const reused = await refreshGmailTokenBundle({
    bundle: { access_token: "access", expires_at: "2026-06-26T10:10:00.000Z" },
    now: new Date("2026-06-26T10:00:00.000Z"),
  });
  assert.equal(reused.accessToken, "access");
  assert.equal(reused.refreshed, false);

  await assert.rejects(
    () => refreshGmailTokenBundle({
      bundle: { access_token: "old", expires_at: "2026-06-26T09:00:00.000Z" },
      clientId: "client",
      clientSecret: "secret",
      now: new Date("2026-06-26T10:00:00.000Z"),
      fetchImpl: async () => ({ ok: true, json: async () => ({ access_token: "new" }) }),
    }),
    /gmail_reconnect_required/,
  );
  assert.equal(gmailReconnectRequired(new Error("gmail_reconnect_required")), true);
});

test("gmail refresh request keeps client secret server side", () => {
  const request = buildGmailRefreshRequest({
    clientId: "client-1",
    clientSecret: "secret-1",
    refreshToken: "refresh-1",
  });

  assert.equal(request.url, "https://oauth2.googleapis.com/token");
  assert.equal(request.method, "POST");
  assert.match(request.body, /client_secret=secret-1/);
  assert.doesNotMatch(request.redacted_body, /secret-1|refresh-1/);
});
