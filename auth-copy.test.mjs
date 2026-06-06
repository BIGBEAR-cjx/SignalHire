import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { authErrorMessage } from "./web/lib/auth-copy.mjs";

test("builds localized auth fallback errors", () => {
  assert.equal(authErrorMessage("zh", "registerNoToken"), "注册未返回令牌");
  assert.equal(authErrorMessage("en", "registerNoToken"), "Registration did not return a token");
  assert.equal(authErrorMessage("en", "loginVerifyFirst"), "Verify your email first");
  assert.equal(authErrorMessage("fr", "loginFailed"), "登录失败");
});

test("preserves service auth errors before falling back", () => {
  assert.equal(authErrorMessage("en", "loginFailed", "Invalid credentials"), "Invalid credentials");
  assert.equal(authErrorMessage("en", "loginFailed", ""), "Login failed");
});

test("auth client wrapper keeps fallback copy keyed", () => {
  const source = readFileSync("web/lib/auth.ts", "utf8");
  assert.equal(source.split("\n").some((line) => /\"[^"]*[\u4e00-\u9fff][^"]*\"/.test(line)), false);
});
