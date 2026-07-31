import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { authorizeOpsUser, isOpsAdmin, normalizeOpsEmail } = await import("./web/lib/ops-auth.ts");
const { hasUnsafeExternalNext, normalizeOpsNext } = await import("./web/lib/ops-navigation.mjs");

test("normalizes the configured official email before authorizing", () => {
  assert.equal(normalizeOpsEmail(" OPS@EXAMPLE.COM "), "ops@example.com");
  assert.equal(isOpsAdmin({ email: "OPS@EXAMPLE.COM" }, "ops@example.com"), true);
  assert.equal(isOpsAdmin({ email: "user@example.com" }, "ops@example.com"), false);
});

test("denies every request when the official email is missing or malformed", () => {
  assert.equal(isOpsAdmin({ email: "ops@example.com" }, ""), false);
  assert.equal(isOpsAdmin({ email: "ops@example.com" }, "not-an-email"), false);
});

test("distinguishes anonymous from authenticated non-ops users", () => {
  assert.deepEqual(authorizeOpsUser(null, "ops@example.com"), { status: 401, user: null });
  assert.deepEqual(
    authorizeOpsUser({ id: "u-1", email: "person@example.com" }, "ops@example.com"),
    { status: 403, user: null },
  );
  assert.deepEqual(
    authorizeOpsUser({ id: "u-2", email: "OPS@EXAMPLE.COM" }, "ops@example.com"),
    { status: 200, user: { id: "u-2", email: "ops@example.com" } },
  );
});

test("ops login only accepts relative /ops destinations", () => {
  assert.equal(hasUnsafeExternalNext("https://evil.example"), true);
  assert.equal(hasUnsafeExternalNext("//evil.example"), true);
  assert.equal(hasUnsafeExternalNext("/app"), true);
  assert.equal(hasUnsafeExternalNext("/ops?user=u1"), false);
  assert.equal(normalizeOpsNext("/ops?user=u1"), "/ops?user=u1");
  assert.equal(normalizeOpsNext("https://evil.example"), "/ops");
});

test("ops console keeps the isolated login and deployment contract visible", async () => {
  const [login, consolePage, env] = await Promise.all([
    readFile(new URL("./web/app/ops/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./web/app/ops/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("./web/.env.example", import.meta.url), "utf8"),
  ]);
  assert.match(login, /normalizeOpsNext/);
  assert.match(consolePage, /\/api\/ops\/whoami/);
  assert.match(consolePage, /Failed reservations/);
  assert.match(env, /^OPS_ADMIN_EMAIL=/m);
  assert.match(env, /^OPS_APP_ORIGIN=/m);
});
