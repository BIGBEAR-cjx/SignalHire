import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQaFixture,
  classifyBrowserPrerequisites,
} from "./web/scripts/qa-browser-scenarios.mjs";

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
