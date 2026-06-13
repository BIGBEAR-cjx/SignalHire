import test from "node:test";
import assert from "node:assert/strict";

import {
  confirmSessionCookie,
  syncSessionCookieFromTokenManager,
  writeAndConfirmSessionCookie,
} from "./web/lib/auth-session-sync.mjs";

test("waits for the session cookie write before resolving", async () => {
  let cookieWriteFinished = false;
  let requestBody = "";

  const syncPromise = syncSessionCookieFromTokenManager(
    {
      auth: {
        tokenManager: {
          getAccessToken: () => "fresh-token",
        },
      },
    },
    async (_url, init) => new Promise((resolve) => {
      setTimeout(() => {
        cookieWriteFinished = true;
        requestBody = String(init.body);
        resolve({ ok: true });
      }, 10);
    }),
    "en",
  );

  assert.equal(cookieWriteFinished, false);

  const didSync = await syncPromise;

  assert.equal(didSync, true);
  assert.equal(cookieWriteFinished, true);
  assert.deepEqual(JSON.parse(requestBody), { accessToken: "fresh-token", locale: "en" });
});

test("does not call the session endpoint when no access token is available", async () => {
  let calls = 0;

  const didSync = await syncSessionCookieFromTokenManager(
    {
      auth: {
        tokenManager: {
          getAccessToken: () => null,
        },
      },
    },
    async () => {
      calls += 1;
      return { ok: true };
    },
  );

  assert.equal(didSync, false);
  assert.equal(calls, 0);
});

test("confirms the server session cookie after writing it", async () => {
  const calls = [];

  const didSync = await writeAndConfirmSessionCookie(
    "fresh-token",
    async (url, init) => {
      calls.push({ url, body: init?.body });
      return { ok: true };
    },
    "en",
  );

  assert.equal(didSync, true);
  assert.deepEqual(calls, [
    { url: "/api/auth/session", body: JSON.stringify({ accessToken: "fresh-token", locale: "en" }) },
    { url: "/api/whoami?locale=en", body: undefined },
  ]);
});

test("rejects a written cookie that the server cannot use", async () => {
  const calls = [];

  const didSync = await writeAndConfirmSessionCookie(
    "fresh-token",
    async (url, init) => {
      calls.push({ url, body: init?.body });
      return { ok: url === "/api/auth/session" };
    },
    "zh",
  );

  assert.equal(didSync, false);
  assert.deepEqual(calls, [
    { url: "/api/auth/session", body: JSON.stringify({ accessToken: "fresh-token", locale: "zh" }) },
    { url: "/api/whoami?locale=zh", body: undefined },
  ]);
});

test("confirms an existing server session cookie", async () => {
  const urls = [];

  const didConfirm = await confirmSessionCookie(async (url) => {
    urls.push(url);
    return { ok: true };
  }, "zh");

  assert.equal(didConfirm, true);
  assert.deepEqual(urls, ["/api/whoami?locale=zh"]);
});
