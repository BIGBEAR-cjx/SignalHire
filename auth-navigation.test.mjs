import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("post-login navigation performs a full page load so server cookies are visible", () => {
  const loginPage = readFileSync("web/app/login/page.tsx", "utf8");
  const homePage = readFileSync("web/app/page.tsx", "utf8");
  const appLayout = readFileSync("web/app/app/layout.tsx", "utf8");

  assert.match(loginPage, /location\.href = next/);
  assert.match(homePage, /location\.href = postAuthUrl/);
  assert.match(appLayout, /location\.reload\(\)/);
});
