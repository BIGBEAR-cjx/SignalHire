import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("search and verify API error responses stay locale-keyed", () => {
  for (const file of ["web/app/api/search/route.ts", "web/app/api/verify/route.ts"]) {
    const source = readFileSync(file, "utf8");
    const hardcodedErrors = source
      .split("\n")
      .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

    assert.deepEqual(hardcodedErrors, [], file);
  }
});

test("backfill API user-facing copy stays locale-keyed", () => {
  for (const file of ["web/app/api/backfill/route.ts", "web/app/api/backfill/merge/route.ts"]) {
    const source = readFileSync(file, "utf8");
    const hardcodedResponses = source
      .split("\n")
      .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));
    const hardcodedLabels = source
      .split("\n")
      .filter((line) => /label\s*=\s*`[^`]*[\u4e00-\u9fff]/.test(line));

    assert.deepEqual([...hardcodedResponses, ...hardcodedLabels], [], file);
  }
});

test("backfill requests include the active locale", () => {
  const source = readFileSync("web/components/ResearchTool.tsx", "utf8");

  assert.match(source, /job,[\s\S]{0,220}locale,[\s\S]{0,220}original_query/);
  assert.match(source, /original_run_id:[\s\S]{0,220}locale,[\s\S]{0,220}backfill_run_id:/);
});

test("job control API error responses stay locale-keyed", () => {
  for (const file of ["web/app/api/status/route.ts", "web/app/api/retry/route.ts", "web/app/api/cancel/route.ts"]) {
    const source = readFileSync(file, "utf8");
    const hardcodedResponses = source
      .split("\n")
      .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

    assert.deepEqual(hardcodedResponses, [], file);
  }
});

test("cancel requests include the active locale", () => {
  const source = readFileSync("web/components/ResearchTool.tsx", "utf8");

  assert.match(source, /fetch\("\/api\/cancel"[\s\S]{0,180}JSON\.stringify\(\{ id: jobId, locale \}\)/);
});

test("outreach API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/outreach/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("outreach requests include the active locale", () => {
  const source = readFileSync("web/components/OutreachModal.tsx", "utf8");

  assert.match(source, /candidate,[\s\S]{0,220}locale,[\s\S]{0,220}tone: nextTone/);
});

test("feedback API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/feedback/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("feedback requests include the active locale", () => {
  const source = readFileSync("web/components/ResearchTool.tsx", "utf8");

  assert.match(source, /run_id: runId,[\s\S]{0,220}locale,[\s\S]{0,220}feedback: searchFeedback/);
});

test("projects collection API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/projects/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("projects collection requests include the active locale", () => {
  const source = readFileSync("web/app/app/projects/page.tsx", "utf8");

  assert.match(source, /fetch\(`\/api\/projects\?locale=\$\{locale\}`\)/);
  assert.match(source, /name: name\.trim\(\),[\s\S]{0,220}brief: brief\.trim\(\) \|\| null,[\s\S]{0,220}locale/);
});

test("dashboard account API error responses stay locale-keyed", () => {
  for (const file of ["web/app/api/overview/route.ts", "web/app/api/history/route.ts", "web/app/api/whoami/route.ts"]) {
    const source = readFileSync(file, "utf8");
    const hardcodedResponses = source
      .split("\n")
      .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

    assert.deepEqual(hardcodedResponses, [], file);
  }
});

test("dashboard account requests include the active locale", () => {
  const overview = readFileSync("web/app/app/page.tsx", "utf8");
  const history = readFileSync("web/app/app/history/page.tsx", "utf8");
  const settings = readFileSync("web/app/app/settings/page.tsx", "utf8");

  assert.match(overview, /fetch\(`\/api\/overview\?locale=\$\{locale\}`\)/);
  assert.match(history, /fetch\(`\/api\/history\?locale=\$\{locale\}`\)/);
  assert.match(settings, /fetch\(`\/api\/whoami\?locale=\$\{locale\}`\)/);
});
