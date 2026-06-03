import test from "node:test";
import assert from "node:assert/strict";

import { syncSessionCookieFromTokenManager } from "./web/lib/auth-session-sync.mjs";

test("waits for the session cookie write before resolving", async () => {
  let cookieWriteFinished = false;

  const syncPromise = syncSessionCookieFromTokenManager(
    {
      auth: {
        tokenManager: {
          getAccessToken: () => "fresh-token",
        },
      },
    },
    async (_url, _init) => new Promise((resolve) => {
      setTimeout(() => {
        cookieWriteFinished = true;
        resolve({ ok: true });
      }, 10);
    }),
  );

  assert.equal(cookieWriteFinished, false);

  const didSync = await syncPromise;

  assert.equal(didSync, true);
  assert.equal(cookieWriteFinished, true);
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
