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

test("verify workspace exposes resume and supporting material uploads", () => {
  const source = readFileSync("web/components/research-workspace.tsx", "utf8");

  assert.match(source, /research\.resumeUploadDrop/);
  assert.match(source, /research\.supportingMaterialUploadDrop/);
  assert.match(source, /supportingMaterialUploadButton/);
  assert.doesNotMatch(source, /educationMaterialUploadDrop|educationMaterialUploadButton/);
});

test("claims expose a unified supplement-material entry", () => {
  const source = readFileSync("web/components/result.tsx", "utf8");

  assert.match(source, /result\.supportingMaterial\.supplementAction/);
  assert.match(source, /\/app\/verify\?bio=/);
  assert.match(source, /supportingMaterialPrefillHeader/);
  assert.doesNotMatch(source, /educationMaterialPrefillHeader|result\.education\.supplementAction/);
});

test("smart search results default to a guided candidate review flow", () => {
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const shortlistCard = resultComponents.slice(
    resultComponents.indexOf("export function ShortlistCard"),
    resultComponents.indexOf("function AuditStat"),
  );

  assert.match(researchTool, /function CandidateReviewCommand/);
  assert.match(researchTool, /function CandidateReviewFlow/);
  assert.match(researchTool, /function AdvancedResultDetails/);
  assert.match(researchTool, /<CandidateReviewCommand[\s\S]{0,900}<CandidateReviewFlow/);
  assert.match(researchTool, /<details[\s\S]{0,600}result\.reviewFlow\.advancedTitle/);
  assert.match(researchTool, /<AdvancedResultDetails[\s\S]*<SearchPlanView result=\{result\}/);
  assert.match(researchTool, /<AdvancedResultDetails[\s\S]*<CandidateComparisonView result=\{result\}/);
  assert.match(researchTool, /setSelectedCandidateIndex\(0\)/);
  assert.doesNotMatch(shortlistCard, /resultCopy\(locale, "viewDetails"\)|resultCopy\(locale, "addToPool"\)|resultCopy\(locale, "removeFromPool"\)/);
});

test("project evidence detail buttons scroll to the candidate detail panel", () => {
  const source = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(source, /candidateDetailRef/);
  assert.match(source, /function openCandidateDetail|const openCandidateDetail/);
  assert.match(source, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(source, /onOpenCandidate=\{\(itemId\) => openCandidateDetail\(itemId\)\}/);
  assert.doesNotMatch(source, /onOpenCandidate=\{\(itemId\) => setSelectedItemId\(itemId\)\}/);
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

test("projects item API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("projects item requests include the active locale", () => {
  const source = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const detailFetches = source.match(/fetch\(`\/api\/projects\/\$\{id\}\?locale=\$\{locale\}`\)/g) ?? [];

  assert.equal(detailFetches.length, 2);
  assert.match(source, /fetch\(`\/api\/projects\/\$\{id\}\?locale=\$\{locale\}`,\s*\{ method: "DELETE" \}\)/);
  assert.match(source, /fetch\(`\/api\/projects\/\$\{p\.id\}`,[\s\S]{0,220}JSON\.stringify\(\{ \.\.\.body, locale \}\)/);
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

test("auth session API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/auth/session/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("auth session requests include the active locale", () => {
  const auth = readFileSync("web/lib/auth.ts", "utf8");
  const sync = readFileSync("web/lib/auth-session-sync.mjs", "utf8");
  const layout = readFileSync("web/app/app/layout.tsx", "utf8");

  assert.match(auth, /async function setSession\(accessToken: string, locale: string\)/);
  assert.match(auth, /writeAndConfirmSessionCookie\(accessToken, fetch, locale\)/);
  assert.match(auth, /setSession\(data\.accessToken, locale\)/);
  assert.match(auth, /confirmSessionCookie\(fetch, locale\)/);
  assert.match(layout, /currentUser\(locale\)/);
  assert.match(sync, /JSON\.stringify\(\{ accessToken: token, locale \}\)/);
  assert.match(sync, /\/api\/whoami\?locale=/);
});

test("shortlist collection API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/shortlist/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("shortlist collection requests include the active locale", () => {
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");
  const shortlistPage = readFileSync("web/app/app/shortlist/page.tsx", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(researchTool, /fetch\(`\/api\/shortlist\?run=\$\{encodeURIComponent\(runId\)\}&locale=\$\{locale\}`\)/);
  assert.match(researchTool, /fetch\(`\/api\/shortlist\?run=\$\{encodeURIComponent\(runId \?\? ""\)\}&idx=\$\{idx\}&locale=\$\{locale\}`/);
  assert.match(researchTool, /candidate_index: idx,[\s\S]{0,220}candidate,[\s\S]{0,220}locale/);
  assert.match(shortlistPage, /fetch\(`\/api\/shortlist\?locale=\$\{locale\}`\)/);
  assert.match(projectPage, /fetch\(`\/api\/shortlist\?project=\$\{encodeURIComponent\(id\)\}&locale=\$\{locale\}`\)/);
});

test("shortlist item API error responses stay locale-keyed", () => {
  const source = readFileSync("web/app/api/shortlist/[id]/route.ts", "utf8");
  const hardcodedResponses = source
    .split("\n")
    .filter((line) => /Response\.json\(\{ error: "[^"]*[\u4e00-\u9fff]/.test(line));

  assert.deepEqual(hardcodedResponses, []);
});

test("shortlist item requests include the active locale", () => {
  const shortlistPage = readFileSync("web/app/app/shortlist/page.tsx", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(shortlistPage, /JSON\.stringify\(\{ \.\.\.body, locale \}\)/);
  assert.match(shortlistPage, /fetch\(`\/api\/shortlist\/\$\{item\.id\}\?locale=\$\{locale\}`,\s*\{ method: "DELETE" \}\)/);
  assert.match(projectPage, /JSON\.stringify\(\{ \.\.\.body, locale \}\)/);
  assert.match(projectPage, /fetch\(`\/api\/shortlist\/\$\{item\.id\}\?locale=\$\{locale\}`,\s*\{ method: "DELETE" \}\)/);
  assert.match(projectPage, /JSON\.stringify\(\{ project_id: null, locale \}\)/);
});
