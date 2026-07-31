import test from "node:test";
import assert from "node:assert/strict";

import * as creditsRuntime from "./web/lib/credits.mjs";
import * as signalsRuntime from "./web/lib/candidate-live-signals.mjs";
import * as tasksRuntime from "./web/lib/search-tasks.mjs";
import * as liveSignalRefreshRuntime from "./web/lib/live-signal-refresh.mjs";
import * as roleAgentRuntime from "./web/lib/role-agent-runner.mjs";

test("extensionless runtime modules expose the server operations their routes import", () => {
  for (const [module, names] of [
    [creditsRuntime, ["grant", "recordOpsIdentityLabel"]],
    [signalsRuntime, ["upsertCandidateLiveSignals", "listActiveCandidateLiveSignals"]],
    [liveSignalRefreshRuntime, ["refreshDueLiveSignals"]],
    [roleAgentRuntime, ["runRoleAgentProjectAction"]],
    [tasksRuntime, [
      "buildMonitorView",
      "ensureSearchTaskProjectAccess",
      "listSearchTasks",
      "createSearchTask",
      "getSearchTask",
      "updateSearchTask",
      "runSearchTaskNow",
      "startMonitorRun",
      "enqueueDueSearchTasks",
    ]],
  ]) {
    for (const name of names) assert.equal(typeof module[name], "function", name);
  }
});

test("Credits and live-signal bridges load their typed server implementations when invoked", async () => {
  assert.deepEqual(
    await signalsRuntime.listActiveCandidateLiveSignals({ userId: "user", projectId: "project" }),
    [],
  );
  await assert.rejects(
    creditsRuntime.grant({ userId: "not-a-uuid", amount: 1, idempotencyKey: "bridge-test" }),
    /user id must be a uuid/i,
  );
});
