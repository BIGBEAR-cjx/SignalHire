# P0 Browser QA Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make real owner/customer browser release checks reproducible and fail-closed when QA evidence is unavailable.

**Architecture:** Extend the existing release-readiness script rather than add a second test runner. A fixture descriptor supplies owner/customer sessions and project/report IDs only at runtime; browser checks capture structured evidence but never tokens.

**Tech Stack:** Next.js, Node.js `node:test`, existing Playwright availability check, Vercel deployment runtime.

---

## File structure

- Modify: `web/scripts/verify-release-readiness.mjs` — structured browser scenarios and result classification.
- Modify: `web/.env.example` — non-secret fixture variable names only.
- Modify: `web/scripts/verify-release-readiness.test.mjs` — script behavior tests (create if absent).
- Create: `web/scripts/qa-browser-scenarios.mjs` — pure scenario/assertion helpers, no credentials.
- Test: `qa-browser-scenarios.test.mjs` — owner/customer/negative scenario contracts.

### Task 1: Define fixture and result contracts

- [ ] **Step 1: Write failing pure-helper tests**

```js
assert.deepEqual(buildQaFixture({}), { owner: null, customer: null, projectId: "", reportId: "" });
assert.equal(classifyBrowserPrerequisites({ playwright: false, fixture: {} }).status, "blocked");
assert.equal(classifyBrowserPrerequisites({ playwright: true, fixture: completeFixture }).status, "ready");
```

- [ ] **Step 2: Run the focused test and verify red**

Run: `node --test qa-browser-scenarios.test.mjs`

Expected: FAIL because `qa-browser-scenarios.mjs` does not yet export the helpers.

- [ ] **Step 3: Implement the minimal helpers**

```js
export function classifyBrowserPrerequisites({ playwright, fixture }) {
  return playwright && fixture?.owner && fixture?.customer && fixture?.projectId
    ? { status: "ready", reason: "" }
    : { status: "blocked", reason: "missing_playwright_or_qa_fixture" };
}
```

- [ ] **Step 4: Re-run the focused test**

Run: `node --test qa-browser-scenarios.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/qa-browser-scenarios.mjs qa-browser-scenarios.test.mjs
git commit -m "test: define browser QA fixture contract"
```

### Task 2: Add customer and negative browser scenarios

**Files:** Modify `web/scripts/verify-release-readiness.mjs`; modify `web/scripts/qa-browser-scenarios.mjs`; test `qa-browser-scenarios.test.mjs`.

- [ ] **Step 1: Write failing scenario tests**

```js
assert.deepEqual(customerScenarioNames(), ["login_redirect", "workspace", "project_tabs", "feedback", "revoked_access"]);
assert.equal(containsSensitiveValue("Bearer secret", ["secret"]), true);
```

- [ ] **Step 2: Run red test**

Run: `node --test qa-browser-scenarios.test.mjs`

Expected: FAIL with missing scenario helper exports.

- [ ] **Step 3: Implement browser runner wiring**

Add one scenario executor per required path. Each records `{name, role, viewport, status, screenshotPath, error}` and redacts environment values before output. Open `/login?next=/client`, `/client`, and `/client/projects/${projectId}`; click each tab by accessible label; submit feedback once; assert a revoked/no-session request is denied.

- [ ] **Step 4: Run helper tests and script help**

Run: `node --test qa-browser-scenarios.test.mjs && node web/scripts/verify-release-readiness.mjs --help`

Expected: PASS and exit 0.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/verify-release-readiness.mjs web/scripts/qa-browser-scenarios.mjs qa-browser-scenarios.test.mjs
git commit -m "test: cover customer portal browser QA paths"
```

### Task 3: Add owner Role Agent and fail-closed reporting

**Files:** Modify `web/scripts/verify-release-readiness.mjs`; modify `web/scripts/qa-browser-scenarios.mjs`; test `qa-browser-scenarios.test.mjs`.

- [ ] **Step 1: Add failing report-classification tests**

```js
assert.equal(summarizeBrowserChecks([{ status: "blocked" }]).releaseReady, false);
assert.equal(summarizeBrowserChecks([{ status: "passed" }]).releaseReady, true);
assert.deepEqual(ownerScenarioNames(), ["client_access_settings", "invite", "revoke", "role_agent_success", "role_agent_error", "role_agent_disabled"]);
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test qa-browser-scenarios.test.mjs`

Expected: FAIL until report summarization exists.

- [ ] **Step 3: Implement owner scenarios and final report behavior**

Run owner settings/invite/revoke with a disposable customer fixture; assert one Role Agent action success, one server-error response with safe UI copy, and one disabled state. With `--browser`, exit non-zero for failed **or blocked** browser evidence; without `--browser`, display `not-run`, never `passed`.

- [ ] **Step 4: Verify and commit**

Run: `node --test qa-browser-scenarios.test.mjs && npm --prefix web run verify:release -- --base-url http://127.0.0.1:3000`

Expected: focused tests pass; release script reports browser `not-run` unless explicitly enabled.

```bash
git add web/scripts/verify-release-readiness.mjs web/scripts/qa-browser-scenarios.mjs qa-browser-scenarios.test.mjs web/.env.example
git commit -m "feat: make browser QA release evidence fail closed"
```
