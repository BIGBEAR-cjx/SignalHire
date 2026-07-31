import test from "node:test";
import assert from "node:assert/strict";

const { authorizeOpsUser, isOpsAdmin, normalizeOpsEmail } = await import("./web/lib/ops-auth.ts");

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
