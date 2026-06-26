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

test("login form cannot fall back to native GET submit before hydration", () => {
  const loginPage = readFileSync("web/app/login/page.tsx", "utf8");

  assert.match(loginPage, /useEffect/);
  assert.match(loginPage, /const \[hydrated, setHydrated\] = useState\(false\)/);
  assert.match(loginPage, /if \(!hydrated\) return/);
  assert.match(loginPage, /<form[^>]*method="post"/s);
  assert.match(loginPage, /disabled=\{!hydrated \|\| loading\}/);
});

test("app shell resolves auth failures into login-required state instead of infinite loading", () => {
  const appLayout = readFileSync("web/app/app/layout.tsx", "utf8");
  const authLib = readFileSync("web/lib/auth.ts", "utf8");

  assert.match(appLayout, /let cancelled = false/);
  assert.match(appLayout, /currentUser\(locale\)[\s\S]*\.catch\(\(\) =>/);
  assert.match(appLayout, /setUser\(null\)/);
  assert.match(authLib, /currentUserFromCookie/);
  assert.match(authLib, /withTimeout\(fetch\(`\/api\/whoami/);
});
