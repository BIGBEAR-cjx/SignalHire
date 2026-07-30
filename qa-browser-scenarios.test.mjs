import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQaFixture,
  classifyBrowserPrerequisites,
  containsSensitiveValue,
  customerScenarioNames,
  projectBrowserScenarioResult,
  runCustomerBrowserScenarios,
  runCustomerFeedbackMutation,
  ownerScenarioNames,
  summarizeBrowserChecks,
} from "./web/scripts/qa-browser-scenarios.mjs";

test("customer browser QA covers the required portal and negative scenarios", () => {
  assert.deepEqual(customerScenarioNames(), [
    "login_redirect",
    "workspace",
    "project_tabs",
    "feedback",
    "revoked_access",
  ]);
});

test("browser QA result helpers recognize and redact sensitive values", () => {
  assert.equal(containsSensitiveValue("Bearer secret", ["secret"]), true);

  const result = projectBrowserScenarioResult({
    name: "workspace",
    role: "customer",
    viewport: "desktop",
    status: "fail",
    screenshotPath: "/tmp/qa.png",
    error: "Request failed with Bearer secret",
    ignored: "must not leak",
  }, ["secret"]);

  assert.deepEqual(Object.keys(result).sort(), [
    "error",
    "name",
    "role",
    "screenshotPath",
    "status",
    "viewport",
  ]);
  assert.equal(result.error, "Request failed with Bearer [REDACTED]");
  assert.equal("ignored" in result, false);
});

test("customer scenarios remain blocked when browser evidence is unavailable", async () => {
  const results = await runCustomerBrowserScenarios({ playwright: null, fixture: {} });

  assert.equal(results.length, 5);
  assert.deepEqual(results.map((result) => result.status), ["blocked", "blocked", "blocked", "blocked", "blocked"]);
  assert.deepEqual(results.map((result) => result.error), [
    "missing_playwright_or_qa_fixture",
    "missing_playwright_or_qa_fixture",
    "missing_playwright_or_qa_fixture",
    "missing_playwright_or_qa_fixture",
    "missing_playwright_or_qa_fixture",
  ]);
  assert.equal(
    results.find((result) => result.name === "revoked_access").role,
    "anonymous_access_negative",
  );
});

test("cookie setup failures redact original, stripped, and decoded QA sessions", async () => {
  const rawSession = "sh_token=token%2Fdecoded";
  const strippedSession = "token%2Fdecoded";
  const decodedSession = "token/decoded";
  const playwright = {
    chromium: {
      launch: async () => ({
        newContext: async () => ({
          addCookies: async () => { throw new Error(`cookie setup failed for ${decodedSession}`); },
          newPage: async () => { throw new Error("page unavailable"); },
          close: async () => {},
        }),
        close: async () => {},
      }),
    },
  };

  const results = await runCustomerBrowserScenarios({
    playwright,
    fixture: {
      owner: "owner-session",
      customer: rawSession,
      projectId: "project-123",
      reportId: "report-456",
    },
    origin: "http://127.0.0.1:3000",
  });
  const serialized = JSON.stringify(results);

  assert.equal(serialized.includes(rawSession), false);
  assert.equal(serialized.includes(strippedSession), false);
  assert.equal(serialized.includes(decodedSession), false);
  assert.match(results.find((result) => result.name === "workspace").error, /\[REDACTED\]/);
});

test("buildQaFixture returns the safe empty fixture", () => {
  assert.deepEqual(buildQaFixture({}), {
    owner: null,
    customer: null,
    projectId: "",
    reportId: "",
  });
});

test("buildQaFixture exposes only fixture presence, never session values", () => {
  assert.deepEqual(
    buildQaFixture({
      owner: "Bearer owner-secret",
      customer: "Bearer customer-secret",
      projectId: " project-123 ",
      reportId: " report-456 ",
    }),
    {
      owner: "configured",
      customer: "configured",
      projectId: "project-123",
      reportId: "report-456",
    },
  );
});

test("browser QA is blocked without Playwright or a complete fixture", () => {
  assert.equal(
    classifyBrowserPrerequisites({ playwright: false, fixture: {} }).status,
    "blocked",
  );
});

test("browser QA is blocked when any required fixture value is missing", () => {
  for (const fixture of [
    { customer: "customer-session-configured", projectId: "project-123" },
    { owner: "owner-session-configured", projectId: "project-123" },
    { owner: "owner-session-configured", customer: "customer-session-configured" },
  ]) {
    assert.equal(
      classifyBrowserPrerequisites({ playwright: true, fixture }).status,
      "blocked",
    );
  }
});

test("browser QA is ready with Playwright and owner, customer, and project fixtures", () => {
  const completeFixture = buildQaFixture({
    owner: "owner-session-configured",
    customer: "customer-session-configured",
    projectId: "project-123",
    reportId: "report-456",
  });

  assert.equal(
    classifyBrowserPrerequisites({ playwright: true, fixture: completeFixture }).status,
    "ready",
  );
});

test("browser QA does not require a report fixture", () => {
  assert.equal(
    classifyBrowserPrerequisites({
      playwright: true,
      fixture: {
        owner: "owner-session-configured",
        customer: "customer-session-configured",
        projectId: "project-123",
      },
    }).status,
    "ready",
  );
});

test("owner browser QA covers client access and Role Agent release evidence", () => {
  assert.deepEqual(ownerScenarioNames(), [
    "client_access_settings",
    "invite",
    "revoke",
    "role_agent_success",
    "role_agent_error",
    "role_agent_disabled",
  ]);
});

test("browser release evidence is fail-closed", () => {
  assert.equal(summarizeBrowserChecks([{ status: "blocked" }]).releaseReady, false);
  assert.equal(summarizeBrowserChecks([{ status: "passed" }]).releaseReady, true);
});

test("revoked access remains an anonymous negative check", async () => {
  const results = await runCustomerBrowserScenarios({ playwright: null, fixture: {} });
  const revoked = results.find((result) => result.name === "revoked_access");

  assert.equal(revoked?.role, "anonymous_access_negative");
});

function fakeFeedbackPage() {
  let feedbackTabClicks = 0;
  let submitClicks = 0;
  let filledNote = "";
  const feedbackTab = {
    first: () => feedbackTab,
    waitFor: async () => {},
    click: async () => { feedbackTabClicks += 1; },
  };
  const submit = {
    first: () => submit,
    waitFor: async () => {},
    click: async () => { submitClicks += 1; },
  };
  const textarea = {
    first: () => textarea,
    waitFor: async () => {},
    fill: async (value) => { filledNote = value; },
  };
  return {
    getByRole: (_role, options) => options.name.source.includes("send feedback") ? submit : feedbackTab,
    locator: () => textarea,
    waitForFunction: async () => {},
    state: () => ({ feedbackTabClicks, submitClicks, filledNote }),
  };
}

test("customer feedback mutation is blocked by default without clicking submit", async () => {
  const page = fakeFeedbackPage();
  const result = await runCustomerFeedbackMutation({
    page,
    allowMutations: false,
    feedbackFixture: "disposable QA feedback",
  });

  assert.deepEqual(result, { status: "blocked", reason: "mutations_not_enabled" });
  assert.deepEqual(page.state(), { feedbackTabClicks: 0, submitClicks: 0, filledNote: "" });
});

test("customer feedback mutation requires an explicit disposable feedback fixture", async () => {
  const page = fakeFeedbackPage();
  const result = await runCustomerFeedbackMutation({ page, allowMutations: true });

  assert.deepEqual(result, { status: "blocked", reason: "missing_feedback_fixture" });
  assert.deepEqual(page.state(), { feedbackTabClicks: 0, submitClicks: 0, filledNote: "" });
});

test("customer feedback mutation runs only with explicit permission and fixture", async () => {
  const page = fakeFeedbackPage();
  const result = await runCustomerFeedbackMutation({
    page,
    allowMutations: true,
    feedbackFixture: "disposable QA feedback",
  });

  assert.deepEqual(result, { status: "pass", reason: "" });
  assert.deepEqual(page.state(), { feedbackTabClicks: 1, submitClicks: 1, filledNote: "disposable QA feedback" });
});
