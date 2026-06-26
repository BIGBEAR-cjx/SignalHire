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
  assert.match(source, /20260624170000_autonomous_recruiter_p1a_gmail_outreach\.sql/);
  assert.match(source, /20260624190000_autonomous_recruiter_p2a_inbox_agent\.sql/);
  assert.match(source, /advance\/rawsql/);
  assert.match(source, /INSFORGE_API_BASE_URL/);
  assert.doesNotMatch(source, /jq/);
});

test("DINQ recruiting UI wires follow-up controls and related talent context", () => {
  const projectDetail = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const shortlist = readFileSync("web/app/app/shortlist/page.tsx", "utf8");
  const outreachModal = readFileSync("web/components/OutreachModal.tsx", "utf8");

  assert.match(projectDetail, /function GmailOutreachPanel/);
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

test("Vercel cron can run background inbox sync without exposing Gmail secrets", () => {
  const config = readFileSync("web/vercel.json", "utf8");
  const cronRoute = readFileSync("web/app/api/cron/inbox-sync/route.ts", "utf8");
  const runner = readFileSync("web/lib/inbox-background-sync.mjs", "utf8");
  const wrapper = readFileSync("web/lib/inbox-background-sync.ts", "utf8");

  assert.match(config, /"path": "\/api\/cron\/inbox-sync"/);
  assert.match(config, /"schedule": "0 2 \* \* \*"/);
  assert.match(cronRoute, /backgroundInboxSync/);
  assert.match(cronRoute, /CRON_SECRET/);
  assert.match(cronRoute, /Bearer \$\{secret\}/);
  assert.match(runner, /maxProjects/);
  assert.match(runner, /maxThreadsPerProject/);
  assert.match(wrapper, /syncGmailInboxForProject/);
  assert.doesNotMatch(cronRoute, /GOOGLE_CLIENT_SECRET|GMAIL_TOKEN_ENCRYPTION_KEY|access_token|refresh_token/);
});

test("background inbox sync summary is persisted and visible in Role Workspace", () => {
  const migration = readFileSync("migrations/20260626130000_autonomous_recruiter_p2h_inbox_sync_summary.sql", "utf8");
  const runner = readFileSync("web/lib/inbox-background-sync.mjs", "utf8");
  const wrapper = readFileSync("web/lib/inbox-background-sync.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(migration, /alter table public\.projects[\s\S]*add column if not exists inbox_sync_summary jsonb/);
  assert.match(runner, /buildProjectInboxSyncSummary/);
  assert.match(runner, /recordProjectSyncSummary/);
  assert.match(wrapper, /updateProjectInboxSyncSummary/);
  assert.match(projects, /inbox_sync_summary/);
  assert.match(projectRoute, /inbox_sync_summary/);
  assert.match(projectPage, /Background sync/);
  assert.match(projectPage, /后台同步/);
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

test("search intake exposes low-friction role inputs and avoids contact unlock", () => {
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");
  const workspace = readFileSync("web/components/research-workspace.tsx", "utf8");
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const roleIntakeRoute = readFileSync("web/app/api/role-intake/route.ts", "utf8");

  assert.match(researchTool, /buildRoleBriefDraft/);
  assert.match(researchTool, /\/api\/role-intake/);
  assert.match(researchTool, /"job_url"/);
  assert.match(researchTool, /"linkedin_url"/);
  assert.match(researchTool, /"similar_profile"/);
  assert.match(researchTool, /"existing_brief"/);
  assert.match(workspace, /roleSourceValues/);
  assert.match(workspace, /placeholderKey/);
  assert.match(workspace, /research\.roleIntake\.jobUrl/);
  assert.match(workspace, /research\.roleIntake\.similarProfile/);
  assert.doesNotMatch(workspace, /onRoleSource\(item\.key,\s*input\)/);
  assert.match(roleIntakeRoute, /fetchRoleSourceText/);
  assert.match(roleIntakeRoute, /source_extraction/);
  assert.match(resultComponents, /handoff_action/);
  assert.doesNotMatch(`${researchTool}\n${resultComponents}`, /Get email -10|contact enrichment|联系方式富集|commercial_action/);
});

test("role workspace exposes PRD candidate statuses and run candidate ingestion", () => {
  const shortlist = readFileSync("web/lib/shortlist.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const route = readFileSync("web/app/api/shortlist/route.ts", "utf8");

  assert.match(shortlist, /"shortlisted"/);
  assert.match(shortlist, /"needs_evidence"/);
  assert.match(shortlist, /"outreach_drafted"/);
  assert.match(shortlist, /"passed"/);
  assert.match(shortlist, /ingestProjectRunCandidates/);
  assert.match(shortlist, /makeProjectCandidateDedupKey/);
  assert.match(projects, /status IN \('shortlisted','interviewing','hired'\)/);
  assert.match(projects, /status IN \('outreach_drafted','contacted'\)/);
  assert.match(projectPage, /candidateStatus\.needsEvidence/);
  assert.match(projectPage, /candidateDisplayStatus/);
  assert.match(route, /ingestProjectRunCandidates/);
});

test("evidence-qualified workspace shows delivery summary and claim counts", () => {
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const talentProfile = readFileSync("web/lib/talent-profile.mjs", "utf8");

  assert.match(resultComponents, /highConfidenceCount/);
  assert.match(resultComponents, /needsVerificationCount/);
  assert.match(resultComponents, /majorGapLabel/);
  assert.match(resultComponents, /row\.claim_counts\.verified/);
  assert.match(talentProfile, /claim_counts/);
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
  assert.match(history, /fetch\(`\/api\/history\?\$\{filtersToParams\(filters, locale, cursor\)\.toString\(\)\}`\)/);
  assert.match(history, /new URLSearchParams\(\{ locale, limit: "30" \}\)/);
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

test("project detail API returns autonomous sourcing candidate graph", () => {
  const route = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");

  assert.match(projects, /buildProjectCandidateGraphView/);
  assert.match(projects, /buildCandidateGraph/);
  assert.match(projects, /candidateGraph/);
  assert.match(route, /candidateGraph: await buildProjectCandidateGraphView/);
});

test("role workspace renders autonomous sourcing graph panel", () => {
  const page = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(page, /AutonomousSourcingPanel/);
  assert.match(page, /candidateGraph/);
  assert.match(page, /ready_for_outreach_count/);
  assert.match(page, /needs_verification_count/);
  assert.match(page, /source_mix/);
  assert.match(page, /candidate\.source_types/);
});

test("project run ingestion preserves candidate source nodes", () => {
  const shortlist = readFileSync("web/lib/shortlist.ts", "utf8");

  assert.match(shortlist, /withCandidateSourceNodes/);
  assert.match(shortlist, /source_nodes/);
  assert.match(shortlist, /source_type: "public_web"/);
  assert.match(shortlist, /source_type: "linkedin_seed"/);
});

test("Gmail integration routes and send route stay server-side and scope-limited", () => {
  const statusRoute = readFileSync("web/app/api/integrations/gmail/status/route.ts", "utf8");
  const connectRoute = readFileSync("web/app/api/integrations/gmail/connect/route.ts", "utf8");
  const callbackRoute = readFileSync("web/app/api/integrations/gmail/callback/route.ts", "utf8");
  const disconnectRoute = readFileSync("web/app/api/integrations/gmail/disconnect/route.ts", "utf8");
  const sendRoute = readFileSync("web/app/api/outreach-threads/[id]/send/route.ts", "utf8");
  const gmailLib = readFileSync("web/lib/gmail.ts", "utf8");
  const pureLib = readFileSync("web/lib/gmail-outreach.mjs", "utf8");
  const tokenLib = readFileSync("web/lib/gmail-token.mjs", "utf8");

  assert.match(statusRoute, /getGmailConnectionStatus/);
  assert.match(connectRoute, /buildConnectUrl/);
  assert.match(callbackRoute, /exchangeGmailCodeForTokens/);
  assert.match(disconnectRoute, /disconnectGmail/);
  assert.match(sendRoute, /sendApprovedOutreachThread/);
  assert.match(gmailLib, /send_error: validation\.reason/);
  assert.match(gmailLib, /send_state_update_failed/);
  assert.match(gmailLib, /if \(!updated\)/);
  assert.match(gmailLib, /GOOGLE_CLIENT_SECRET/);
  assert.match(gmailLib, /GMAIL_TOKEN_ENCRYPTION_KEY/);
  assert.match(gmailLib, /refreshGmailTokenBundle/);
  assert.match(gmailLib, /encryptTokenBundle\(refreshedBundle/);
  assert.match(gmailLib, /buildGmailAuthUrl/);
  assert.match(pureLib, /gmail\.send/);
  assert.match(pureLib, /gmail\.readonly/);
  assert.doesNotMatch(pureLib, /gmail\.modify/);
  assert.match(tokenLib, /gmail_reconnect_required/);
  assert.doesNotMatch(tokenLib, /console\.log|console\.error/);
});

test("outreach schema migration adds Gmail connection and send lifecycle fields", () => {
  const migration = readFileSync("migrations/20260624170000_autonomous_recruiter_p1a_gmail_outreach.sql", "utf8");

  assert.match(migration, /create table if not exists public\.gmail_connections/);
  assert.match(migration, /encrypted_token_bundle/);
  assert.match(migration, /alter table public\.outreach_threads/);
  assert.match(migration, /add column if not exists contact_profile jsonb/);
  assert.match(migration, /add column if not exists sequence_messages jsonb/);
  assert.match(migration, /gmail_message_id/);
  assert.match(migration, /gmail_thread_id/);
});

test("role workspace exposes controlled Gmail outreach actions", () => {
  const page = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(page, /GmailOutreachPanel/);
  assert.match(page, /\/api\/integrations\/gmail\/status/);
  assert.match(page, /\/api\/integrations\/gmail\/connect/);
  assert.match(page, /approveOutreachThread/);
  assert.match(page, /sendOutreachThread/);
  assert.match(page, /sendErrors/);
  assert.match(page, /contactability_score/);
  assert.match(page, /confidence/);
  assert.match(page, /source/);
});

test("Gmail inbox agent persists only role-related threads and renders queues", () => {
  const migration = readFileSync("migrations/20260624190000_autonomous_recruiter_p2a_inbox_agent.sql", "utf8");
  const inboxLib = readFileSync("web/lib/inbox.ts", "utf8");
  const inboxSyncCore = readFileSync("web/lib/inbox-sync-core.mjs", "utf8");
  const inboxAgent = readFileSync("web/lib/inbox-agent.mjs", "utf8");
  const inboxActions = readFileSync("web/lib/inbox-actions.mjs", "utf8");
  const inboxActionsRoute = readFileSync("web/app/api/inbox/actions/route.ts", "utf8");
  const syncRoute = readFileSync("web/app/api/inbox/gmail/sync/route.ts", "utf8");
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(migration, /create table if not exists public\.inbox_threads/);
  assert.match(migration, /classification/);
  assert.match(inboxLib, /listRoleRelatedOutreachThreads/);
  assert.match(inboxLib, /gmail_thread_id/);
  assert.match(inboxLib, /syncGmailInboxForProjectCore/);
  assert.match(inboxSyncCore, /latestCandidateMessage/);
  assert.match(inboxSyncCore, /status\.gmail_address/);
  assert.match(inboxSyncCore, /gmail_readonly_scope_missing/);
  assert.match(inboxSyncCore, /gmail_reconnect_required/);
  assert.match(inboxSyncCore, /last_synced_at/);
  assert.match(inboxSyncCore, /needs_reply/);
  assert.match(inboxSyncCore, /follow_up_later/);
  assert.match(inboxAgent, /classifyInboxReply/);
  assert.match(inboxAgent, /action_status/);
  assert.match(inboxAgent, /no_reply_follow_up/);
  assert.match(inboxAgent, /due_follow_up/);
  assert.match(inboxAgent, /today_queue/);
  assert.match(inboxAgent, /today_rank/);
  assert.match(inboxActions, /buildInboxActionPatch/);
  assert.match(inboxActions, /save_follow_up_draft/);
  assert.match(inboxActions, /signalhire-inbox-action/);
  assert.match(inboxActionsRoute, /runInboxAction/);
  assert.match(inboxActionsRoute, /getOutreachThread/);
  assert.match(inboxActionsRoute, /updateOutreachThread/);
  assert.match(syncRoute, /syncGmailInboxForProject/);
  assert.match(projectRoute, /inboxQueue: await buildProjectInboxQueueView/);
  assert.match(projectPage, /InboxAgentPanel/);
  assert.match(projectPage, /\/api\/inbox\/actions/);
  assert.match(projectPage, /Last synced/);
  assert.match(projectPage, /today_queue/);
  assert.match(projectPage, /Today priority queue/);
  assert.match(projectPage, /Reconnect Gmail inbox access/);
  assert.match(projectPage, /Sync result/);
  assert.match(projectPage, /inboxPriorityLine/);
  assert.match(projectPage, /Mark interview-ready/);
  assert.match(projectPage, /Copy candidate reply/);
  assert.match(projectPage, /Copy manager handoff/);
  assert.match(projectPage, /Schedule follow-up/);
  assert.match(projectPage, /Save suggested draft/);
  assert.match(projectPage, /Save follow-up draft/);
  assert.match(projectPage, /Copy follow-up draft/);
  assert.match(projectPage, /inboxActionDisplayLabel/);
  assert.match(projectPage, /保存到期跟进草稿/);
  assert.match(projectPage, /Interested Candidate Queue/);
});

test("controlled inbox draft send stays server-side and human-approved", () => {
  const route = readFileSync("web/app/api/inbox/actions/send/route.ts", "utf8");
  const gmailLib = readFileSync("web/lib/gmail.ts", "utf8");
  const pureLib = readFileSync("web/lib/gmail-outreach.mjs", "utf8");
  const inboxActions = readFileSync("web/lib/inbox-actions.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(route, /getUser/);
  assert.match(route, /sendInboxDraftThread/);
  assert.match(route, /result\.error === "thread_not_found"/);
  assert.match(route, /status: 404/);
  assert.match(gmailLib, /sendInboxDraftThread/);
  assert.match(gmailLib, /buildGmailSendPayload/);
  assert.match(gmailLib, /threadId: thread\.gmail_thread_id/);
  assert.match(pureLib, /validateInboxDraftSend/);
  assert.match(pureLib, /buildGmailSendPayload/);
  assert.match(inboxActions, /buildInboxDraftSentPatch/);
  assert.match(projectPage, /type InboxActionStatus = [^;]+\"sent\"/);
  assert.match(projectPage, /Send saved draft/);
  assert.match(projectPage, /发送已保存草稿/);
  assert.match(projectPage, /sendInboxDraft/);
  assert.doesNotMatch(route, /GOOGLE_CLIENT_SECRET|GMAIL_TOKEN_ENCRYPTION_KEY|access_token|refresh_token/);
});

test("contact resolution route uses server-only provider config and Role Workspace renders review actions", () => {
  const route = readFileSync("web/app/api/contact-resolution/resolve/route.ts", "utf8");
  const bulkRoute = readFileSync("web/app/api/contact-resolution/bulk/route.ts", "utf8");
  const routeCore = readFileSync("web/lib/contact-resolution-route.mjs", "utf8");
  const statusRoute = readFileSync("web/app/api/contact-resolution/status/route.ts", "utf8");
  const providers = readFileSync("web/lib/contact-providers.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(route, /getUser/);
  assert.match(route, /runContactResolution/);
  assert.match(route, /getOutreachThread/);
  assert.match(routeCore, /buildContactProviderConfig/);
  assert.match(routeCore, /getOutreachThread\(\{ userId: user\.id, id \}\)/);
  assert.match(routeCore, /resolveHunterContact/);
  assert.match(routeCore, /updateOutreachThread/);
  assert.match(routeCore, /runBulkContactResolution/);
  assert.match(routeCore, /maxProviderCalls = 10/);
  assert.match(bulkRoute, /runBulkContactResolution/);
  assert.match(bulkRoute, /listOutreachThreads/);
  assert.match(bulkRoute, /process\.env/);
  assert.match(statusRoute, /buildContactProviderConfig\(process\.env\)/);
  assert.match(providers, /HUNTER_API_KEY/);
  assert.match(providers, /https:\/\/api\.hunter\.io\/v2\/email-finder/);
  assert.match(providers, /redacted_url/);
  assert.doesNotMatch(projectPage, /HUNTER_API_KEY/);
  assert.match(projectPage, /resolveContact/);
  assert.match(projectPage, /Review contact/);
  assert.match(projectPage, /Resolve contact/);
  assert.match(projectPage, /resolveMissingContacts/);
  assert.match(projectPage, /Resolve missing contacts/);
  assert.match(projectPage, /Contact resolution summary/);
  assert.match(projectPage, /contactResolutionReasonLabel/);
  assert.match(projectPage, /bulkContactResult\.items/);
  assert.doesNotMatch(projectPage, /bulkContactResult\.items\?\.slice/);
  assert.match(projectPage, /Already has a sendable sourced email/);
  assert.match(projectPage, /Hunter contact provider is not configured/);
  assert.match(projectPage, /sendDisabledReason/);
  assert.match(projectPage, /contactRiskWarning/);
  assert.match(projectPage, /deliverability_status/);
  assert.match(projectPage, /last_verified_at/);
  assert.match(projectPage, /Copy email/);
  assert.match(projectPage, /linkedin_url/);
  assert.match(projectPage, /Copy manager handoff/);
});

test("OpenJobs Mira provider pull is tenant-scoped and writes low-evidence project candidates", () => {
  const route = readFileSync("web/app/api/providers/openjobs/search/route.ts", "utf8");
  const routeCore = readFileSync("web/lib/openjobs-route.mjs", "utf8");
  const provider = readFileSync("web/lib/openjobs-provider.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(route, /getUser/);
  assert.match(route, /runOpenJobsProviderSearch/);
  assert.match(route, /getProject/);
  assert.match(route, /searchMiraPeople/);
  assert.match(route, /miraProfilesToShortlistCandidates/);
  assert.match(route, /addItem/);
  assert.match(routeCore, /getProject\(user\.id, projectId\)/);
  assert.match(routeCore, /status: "needs_evidence"/);
  assert.match(provider, /people-search/);
  assert.match(provider, /detail-by-id/);
  assert.match(projectPage, /pullOpenJobsCandidates/);
  assert.match(projectPage, /OpenJobs/);
});
