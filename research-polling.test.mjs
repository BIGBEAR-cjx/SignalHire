import test from "node:test";
import assert from "node:assert/strict";

import {
  buildResearchRunHref,
  nextResearchPollDelayMs,
  RESEARCH_POLL_INTERVAL_MS,
  RESEARCH_POLL_SLOW_INTERVAL_MS,
  RESEARCH_POLL_SLOW_AFTER_MS,
} from "./web/lib/research-polling.mjs";

test("research polling slows down after the foreground window but keeps polling", () => {
  assert.equal(nextResearchPollDelayMs(RESEARCH_POLL_SLOW_AFTER_MS - 1), RESEARCH_POLL_INTERVAL_MS);
  assert.equal(nextResearchPollDelayMs(RESEARCH_POLL_SLOW_AFTER_MS), RESEARCH_POLL_SLOW_INTERVAL_MS);
  assert.equal(nextResearchPollDelayMs(RESEARCH_POLL_SLOW_AFTER_MS + 60_000), RESEARCH_POLL_SLOW_INTERVAL_MS);
});

test("active research jobs link back to a resumable run page", () => {
  assert.equal(buildResearchRunHref({ kind: "search", id: "run-1" }), "/app/search?run=run-1");
  assert.equal(buildResearchRunHref({ kind: "verify", id: "run-2" }), "/app/verify?run=run-2");
  assert.equal(
    buildResearchRunHref({ kind: "search", id: "run 3", projectId: "project/1" }),
    "/app/search?run=run+3&project=project%2F1",
  );
});
