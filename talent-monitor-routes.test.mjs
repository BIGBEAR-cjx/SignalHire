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

test("monitor service helpers scope every task-run lookup and mutation to its owner", () => {
  assert.match(taskLibrary, /\.eq\("search_task_id", task\.id\)[\s\S]*\.eq\("user_id", task\.user_id\)/);
  assert.match(taskLibrary, /p_user_id: monitor\.user_id/);
  assert.match(taskLibrary, /\.eq\("id", task\.id\)\.eq\("user_id", task\.user_id\)/);
  assert.doesNotMatch(taskLibrary, /from\("credit_accounts"\)\.update/);
});

test("monitor state persistence fails closed instead of accepting an absent client or SDK error", () => {
  assert.match(taskLibrary, /if \(!client\) throw new Error\("Talent Monitor storage is not configured"\)/);
  assert.match(taskLibrary, /if \(error\) throw new Error\("Talent Monitor pause was not persisted"\)/);
  assert.match(taskLibrary, /if \(error\) throw new Error\("Talent Monitor queue state was not persisted"\)/);
  assert.match(roleAgentCore, /if \(!queued \|\| \(!queued\.jobId && !queued\.duplicate\)\) throw new Error\("search_task_run_failed"\)/);
});
