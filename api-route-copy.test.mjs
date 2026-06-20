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

test("search enqueue includes cached candidate hints for next-round recall", () => {
  const source = readFileSync("web/app/api/search/route.ts", "utf8");

  assert.match(source, /findCachedCandidateProfilesForSearch/);
  assert.match(source, /const cachedCandidateHints = await findCachedCandidateProfilesForSearch/);
  assert.match(source, /cachedCandidateHints,/);
});

test("worker runs open evidence precheck before search prompt", () => {
  const source = readFileSync("worker/index.mjs", "utf8");

  assert.match(source, /runOpenEvidenceSourcePrecheck/);
  assert.match(source, /openEvidenceLeads/);
  assert.match(source, /searchPrompt\(queryText, platformLanguage, candidateHints, openEvidenceLeads, agentSearchStrategy\)/);
});

test("search queue and worker persist agent execution layer", () => {
  const dbSource = readFileSync("web/lib/db.ts", "utf8");
  const workerSource = readFileSync("worker/index.mjs", "utf8");
  const workerLibSource = readFileSync("worker/lib.mjs", "utf8");

  assert.match(dbSource, /buildAgentSearchStrategy/);
  assert.match(dbSource, /progress:[\s\S]{0,220}agent_execution/);
  assert.match(workerLibSource, /AGENT EXECUTION STRATEGY/);
  assert.match(workerSource, /agentSearchStrategy/);
  assert.match(workerSource, /buildFallbackAgentSearchStrategy/);
  assert.match(workerSource, /executionTraceFromProgress/);
  assert.match(workerSource, /attachAgentExecutionLayer/);
  assert.match(workerSource, /candidate_submission_events/);
  assert.match(workerSource, /delivery_clusters/);
  assert.match(workerSource, /duration_ms/);
});

test("worker persists open evidence precheck leads before model identity resolution", () => {
  const source = readFileSync("worker/index.mjs", "utf8");

  assert.match(source, /OPEN_EVIDENCE_LEAD_TABLE = "open_evidence_leads"/);
  assert.match(source, /buildOpenEvidenceLeadRowsForRun/);
  assert.match(source, /upsertOpenEvidenceLeadsForRun/);
  assert.match(source, /sourceRunId: job\.id/);
});

test("worker logs open evidence provider stats for crawler observability", () => {
  const source = readFileSync("worker/index.mjs", "utf8");

  assert.match(source, /formatOpenEvidenceProviderStats/);
  assert.match(source, /result\.provider_stats/);
  assert.match(source, /开放证据预检统计/);
});

test("schema verification covers AI talent cache tables", () => {
  const pkg = readFileSync("web/package.json", "utf8");
  const source = readFileSync("web/scripts/check-ai-talent-cache-schema.mjs", "utf8");
  const researchRunsSource = readFileSync("web/scripts/check-research-runs-schema.mjs", "utf8");

  assert.match(pkg, /"verify:schema": "node --env-file-if-exists=\.env\.local scripts\/check-research-runs-schema\.mjs && node --env-file-if-exists=\.env\.local scripts\/check-ai-talent-cache-schema\.mjs"/);
  assert.match(source, /candidate_profiles/);
  assert.match(source, /candidate_evidence_sources/);
  assert.match(source, /open_evidence_leads/);
  assert.match(source, /search_tasks/);
  assert.match(source, /outreach_threads/);
  assert.match(source, /source_run_id/);
  assert.match(source, /cache_key/);
  assert.match(researchRunsSource, /search_task_id/);
});

test("AI talent cache migration can be applied without jq", () => {
  const pkg = readFileSync("web/package.json", "utf8");
  const source = readFileSync("web/scripts/apply-ai-talent-cache-migration.mjs", "utf8");

  assert.match(pkg, /"migrate:ai-cache": "node --env-file-if-exists=\.env\.local scripts\/apply-ai-talent-cache-migration\.mjs"/);
  assert.match(source, /20260612110000_candidate-profile-cache\.sql/);
  assert.match(source, /20260615100000_dinq-recruiting-agent-mvp\.sql/);
  assert.match(source, /advance\/rawsql/);
  assert.match(source, /INSFORGE_API_BASE_URL/);
  assert.doesNotMatch(source, /jq/);
});

test("DINQ recruiting UI wires follow-up controls and related talent context", () => {
  const projectDetail = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const shortlist = readFileSync("web/app/app/shortlist/page.tsx", "utf8");
  const outreachModal = readFileSync("web/components/OutreachModal.tsx", "utf8");

  assert.match(projectDetail, /function OutreachQueuePanel/);
  assert.match(projectDetail, /updateOutreachThread/);
  assert.match(projectDetail, /next_follow_up_at/);
  assert.match(projectDetail, /discovery_items/);
  assert.match(projectDetail, /Evidence updated/);
  assert.match(projectDetail, /relatedCandidates=\{\(items \?\? \[\]\)\.map\(\(it\) => it\.candidate\)/);
  assert.match(shortlist, /relatedCandidates=\{items\.map\(\(it\) => it\.candidate\)\}/);
  assert.match(shortlist, /relatedCandidates=\{relatedCandidates\}/);
  assert.match(outreachModal, /nextFollowUpAt/);
  assert.match(outreachModal, /status,/);
  assert.match(outreachModal, /saveThread\("contacted"\)/);
  assert.match(outreachModal, /next_follow_up_at:[\s\S]{0,120}nextFollowUpAt/);
});

test("DINQ recruiting APIs validate tenant-scoped relationships", () => {
  const searchTasksRoute = readFileSync("web/app/api/search-tasks/route.ts", "utf8");
  const outreachRoute = readFileSync("web/app/api/outreach-threads/route.ts", "utf8");
  const searchTasksLib = readFileSync("web/lib/search-tasks.ts", "utf8");
  const outreachLib = readFileSync("web/lib/outreach-threads.ts", "utf8");

  assert.match(searchTasksRoute, /ensureSearchTaskProjectAccess/);
  assert.match(searchTasksLib, /ensureSearchTaskProjectAccess/);
  assert.match(searchTasksLib, /from\("projects"\)[\s\S]{0,260}\.eq\("user_id", userId\)/);
  assert.match(outreachRoute, /ensureOutreachRelationshipAccess/);
  assert.match(outreachLib, /ensureOutreachRelationshipAccess/);
  assert.match(outreachLib, /from\("shortlist_items"\)[\s\S]{0,320}\.eq\("user_id", input\.userId\)/);
  assert.match(outreachLib, /shortlistProjectId !== \(input\.projectId \?\? null\)/);
});

test("Vercel cron triggers due Talent Monitor tasks", () => {
  const config = readFileSync("web/vercel.json", "utf8");
  const cronRoute = readFileSync("web/app/api/cron/search-tasks/route.ts", "utf8");

  assert.match(config, /"path": "\/api\/cron\/search-tasks"/);
  assert.match(cronRoute, /enqueueDueSearchTasks\(10\)/);
  assert.match(cronRoute, /CRON_SECRET/);
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
  assert.match(source, /research\.jdUploadDrop/);
  assert.match(source, /research\.jdUploadButton/);
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

test("smart search results default to the search result workspace flow", () => {
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const shortlistCard = resultComponents.slice(
    resultComponents.indexOf("export function ShortlistCard"),
    resultComponents.indexOf("function AuditStat"),
  );

  assert.match(researchTool, /function AdvancedResultDetails/);
  assert.match(researchTool, /<SearchResultWorkspaceView/);
  assert.match(researchTool, /<details[\s\S]{0,600}result\.reviewFlow\.advancedTitle/);
  assert.match(researchTool, /<AdvancedResultDetails[\s\S]*<SearchPlanView result=\{result\}/);
  assert.match(researchTool, /<AdvancedResultDetails[\s\S]*<CandidateComparisonView result=\{result\}/);
  assert.match(researchTool, /const activeCandidateIndex = isTalentSearchResult\(result\)/);
  assert.match(researchTool, /selectedIndex=\{selectedCandidateIndex\}/);
  assert.match(resultComponents, /const requestedIndex = selectedIndex \?\? workspace\.selected_candidate_index \?\? 0/);
  assert.match(resultComponents, /export function SearchResultWorkspaceView/);
  assert.match(resultComponents, /workspace\.agent_execution\.telemetry\.source_mix/);
  assert.doesNotMatch(shortlistCard, /resultCopy\(locale, "viewDetails"\)|resultCopy\(locale, "addToPool"\)|resultCopy\(locale, "removeFromPool"\)/);
});

test("started search flow hides the editable setup panels", () => {
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");

  assert.match(researchTool, /const showSearchSetup = !isSearch \|\| \(!searchRunStarted && !searchIntakeDraft\);/);
  assert.doesNotMatch(researchTool, /const searchInputStage = \(/);
  assert.match(researchTool, /\{showSearchSetup \? \(\s*<ResearchInputStage/);
  assert.doesNotMatch(researchTool, /function CollapsedSearchSetup|<CollapsedSearchSetup|searchRunStarted \? \(/);
});

test("root html tolerates browser extension hydration attributes", () => {
  const source = readFileSync("web/app/layout.tsx", "utf8");

  assert.match(source, /<html[\s\S]{0,160}suppressHydrationWarning/);
});

test("public search reports hide internal search process details", () => {
  const source = readFileSync("web/app/r/[id]/page.tsx", "utf8");
  const talentBranch = source.slice(source.indexOf("talentResult ?"), source.indexOf(": legacyCandidates.length"));

  assert.match(talentBranch, /<ShortlistDeliveryReportView result=\{talentResult\} locale=\{locale\} \/>/);
  assert.match(talentBranch, /<CandidateProfileView candidate=\{candidate\} result=\{talentResult\} locale=\{locale\} \/>/);
  assert.doesNotMatch(talentBranch, /<SearchPlanView|<SourceExecutionView|<CoverageBackfillView|<TalentMapView/);
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
  const source = readFileSync("web/app/api/feedback/route.ts", "utf8");

  assert.match(source, /const locale = normalizeLocale\(body\.locale\)/);
  assert.match(source, /saveSearchFeedback\(\{[\s\S]{0,220}locale,[\s\S]{0,220}feedback/);
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
