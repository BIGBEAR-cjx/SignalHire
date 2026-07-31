import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runRoute = readFileSync("web/app/api/search-tasks/[id]/run/route.ts", "utf8");
const cronRoute = readFileSync("web/app/api/cron/search-tasks/route.ts", "utf8");
const taskLibrary = readFileSync("web/lib/search-tasks.ts", "utf8");
const roleAgent = readFileSync("web/lib/role-agent-runner.ts", "utf8");
const roleAgentCore = readFileSync("web/lib/role-agent-runner.mjs", "utf8");

test("manual monitor route authenticates before using the shared start path", () => {
  assert.match(runRoute, /const user = await getUser\(\)/);
  assert.match(runRoute, /startMonitorRun\(\{ userId: user\.id, id \}\)/);
  assert.doesNotMatch(runRoute, /enqueue\(/);
});

test("cron and Role Agent reach the same monitor-start path", () => {
  assert.match(cronRoute, /enqueueDueSearchTasks\(10\)/);
  assert.match(taskLibrary, /const queued = await startMonitorRun\(\{ userId: row\.user_id, id: row\.id \}\)/);
  assert.match(roleAgent, /runSearchTaskNow/);
  assert.match(taskLibrary, /const started = await startMonitorRun\(input\)/);
});

test("monitor start passes the authenticated task owner into service-only RPCs", () => {
  assert.match(taskLibrary, /p_user_id: monitor\.user_id/);
  assert.match(taskLibrary, /p_search_task_id: monitor\.id/);
  assert.doesNotMatch(taskLibrary, /from\("credit_accounts"\)\.update/);
});

test("monitor routes use the database-owned atomic start and reconciliation contracts", () => {
  assert.match(taskLibrary, /monitorRpc\("start_monitor_run"/);
  assert.match(taskLibrary, /monitorRpc\("activate_monitor_run"/);
  assert.match(taskLibrary, /monitorRpc\("reconcile_stalled_monitor_runs"/);
  assert.doesNotMatch(taskLibrary, /credits\.reserve/);
  assert.doesNotMatch(taskLibrary, /enqueueMonitorResearchRun/);
  assert.match(roleAgentCore, /if \(!queued \|\| \(!queued\.jobId && !queued\.duplicate\)\) throw new Error\("search_task_run_failed"\)/);
});
