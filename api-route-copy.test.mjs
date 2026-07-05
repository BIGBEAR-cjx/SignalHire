import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function extractFunctionSource(source, name) {
  const start = source.indexOf(`async function ${name}`);
  if (start === -1) return "";
  const bodyStart = source.indexOf("{", start);
  if (bodyStart === -1) return "";
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  return "";
}

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
  assert.match(source, /projects/);
  assert.match(source, /outreach_settings/);
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
  assert.match(source, /20260630120000_outreach_followup_settings\.sql/);
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

test("outreach follow-up cron saves review drafts without Gmail auto-send", () => {
  const migration = readFileSync("migrations/20260630120000_outreach_followup_settings.sql", "utf8");
  const config = readFileSync("web/vercel.json", "utf8");
  const route = readFileSync("web/app/api/cron/outreach-followups/route.ts", "utf8");
  const runner = readFileSync("web/lib/outreach-followups.ts", "utf8");
  const pure = readFileSync("web/lib/outreach-followups.mjs", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const settingsRoute = readFileSync("web/app/api/projects/[id]/outreach-settings/route.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(migration, /add column if not exists outreach_settings jsonb/);
  assert.match(config, /"path": "\/api\/cron\/outreach-followups"/);
  assert.match(route, /processDueFollowUpDrafts/);
  assert.match(route, /CRON_SECRET/);
  assert.match(runner, /outreach_settings->>'auto_follow_up_only'/);
  assert.match(runner, /updateOutreachThread/);
  assert.doesNotMatch(`${route}\n${runner}`, /sendApprovedOutreachThread|sendInboxDraftThread|sendViaGmail|messages\/send/);
  assert.match(pure, /step < 2/);
  assert.match(pure, /follow_up_due/);
  assert.match(pure, /draft_for_review/);
  assert.match(projects, /updateProjectOutreachSettings/);
  assert.match(projects, /buildRoleOutreachSettings\(r\.outreach_settings\)/);
  assert.match(settingsRoute, /updateProjectOutreachSettings/);
  assert.match(projectPage, /persistedSettings/);
  assert.match(projectPage, /\/api\/projects\/\$\{(?:projectId|project\.id)\}\/outreach-settings/);
  assert.doesNotMatch(projectPage, /localStorage\.setItem\(`signalhire:outreach-settings/);
});

test("follow-up review drafts are visibly distinct and cron summary is persisted", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const runner = readFileSync("web/lib/outreach-followups.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");

  assert.match(projectPage, /latestFollowUpDraftState/);
  assert.match(projectPage, /Due follow-up draft/);
  assert.match(projectPage, /到期跟进草稿/);
  assert.match(projectPage, /First email draft/);
  assert.match(projectPage, /首封草稿/);
  assert.match(projectPage, /projectFollowUpSchedulerSummaryLabel/);
  assert.match(runner, /recordProjectOutreachFollowUpSummary/);
  assert.match(projects, /outreach_followup_summary/);
});

test("Gmail draft API creates review drafts without sending", () => {
  const migration = readFileSync("migrations/20260630130000_outreach_gmail_draft_fields.sql", "utf8");
  const runner = readFileSync("web/scripts/apply-ai-talent-cache-migration.mjs", "utf8");
  const schema = readFileSync("web/scripts/check-ai-talent-cache-schema.mjs", "utf8");
  const route = readFileSync("web/app/api/outreach-threads/[id]/draft/route.ts", "utf8");
  const gmail = readFileSync("web/lib/gmail.ts", "utf8");
  const outreach = readFileSync("web/lib/outreach-threads.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(migration, /add column if not exists gmail_draft_id text/);
  assert.match(migration, /add column if not exists gmail_draft_updated_at timestamptz/);
  assert.match(runner, /20260630130000_outreach_gmail_draft_fields\.sql/);
  assert.match(schema, /gmail_draft_id/);
  assert.match(schema, /gmail_draft_updated_at/);
  assert.match(route, /saveGmailDraftForThread/);
  assert.match(gmail, /drafts/);
  assert.match(gmail, /saveGmailDraftForThread/);
  assert.match(outreach, /gmail_draft_id/);
  assert.match(projectPage, /saveGmailDraft/);
  assert.match(projectPage, /Save Gmail draft/);
  assert.doesNotMatch(route, /sendApprovedOutreachThread|sendInboxDraftThread|messages\/send/);
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

test("one-prompt role creation activates default Role Agent settings", () => {
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const roleIntakeRoute = readFileSync("web/app/api/role-intake/route.ts", "utf8");
  const outreachSettings = readFileSync("web/lib/outreach-settings.mjs", "utf8");

  assert.match(projects, /const roleAgentSettings = buildRoleOutreachSettings\(\)/);
  assert.match(projects, /outreach_settings: roleAgentSettings/);
  assert.match(roleIntakeRoute, /role_agent_defaults/);
  assert.match(roleIntakeRoute, /buildRoleOutreachSettings\(\)/);
  assert.match(outreachSettings, /agent_status: agentStatus === "paused" \? "paused" : "active"/);
  assert.match(outreachSettings, /capacity_goal: normalizeCapacityGoal/);
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

test("Lessie-inspired recruiting flow exposes preview, source mix, and follow-up safeguards", () => {
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const searchPage = readFileSync("web/app/app/search/page.tsx", "utf8");
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const leadPreviewPanel = readFileSync("web/components/LeadPreviewPanel.tsx", "utf8");
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const candidateGraph = readFileSync("web/lib/candidate-graph.mjs", "utf8");

  assert.match(projectRoute, /buildProjectLeadPreviewView\(user\.id, id\)/);
  assert.match(projectRoute, /leadPreview/);
  assert.match(projects, /FROM open_evidence_leads/);
  assert.match(projects, /source_run_id = \$2/);
  assert.match(projects, /ORDER BY observed_at DESC/);
  assert.doesNotMatch(projects, /WHERE user_id = \$1 AND run_id = \$2/);
  assert.doesNotMatch(projects, /ORDER BY created_at DESC/);
  assert.match(projects, /progress,result/);
  assert.match(searchPage, /projectLeadPreview/);
  assert.match(researchTool, /LeadPreviewPanel/);
  assert.match(researchTool, /applyLeadPreviewConstraint/);
  assert.match(projectPage, /view=\{detail\.leadPreview\}/);
  assert.match(leadPreviewPanel, /buildLeadPreviewConstraint/);
  assert.match(leadPreviewPanel, /can_outreach/);
  assert.match(leadPreviewPanel, /sourceTypeTooltip/);
  assert.match(candidateGraph, /classifySourceType/);
  assert.match(resultComponents, /SourceMixSummaryView/);
  assert.match(resultComponents, /sourceTypeTooltip/);
  assert.match(projectPage, /auto_follow_up_only/);
  assert.match(projectPage, /follow_up_interval_days/);
  assert.match(projectPage, /buildAgencyOutreachActivityDigest/);
  assert.match(projectPage, /manual_approval_required/);
  assert.match(projectPage, /draft_for_review/);
  assert.match(projectPage, /delay_days: index === 0 \? undefined : 7/);
});

test("public report renders SignalHire Smart Report before candidate details", () => {
  const resultComponents = readFileSync("web/components/result.tsx", "utf8");
  const reportPage = readFileSync("web/app/r/[id]/page.tsx", "utf8");
  const dbSource = readFileSync("web/lib/db.ts", "utf8");
  const projectSource = readFileSync("web/lib/projects.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const researchTool = readFileSync("web/components/ResearchTool.tsx", "utf8");
  const reportFeedbackRoute = readFileSync("web/app/api/reports/[id]/feedback/route.ts", "utf8");
  const reportFeedbackForm = readFileSync("web/components/ClientReportFeedbackForm.tsx", "utf8");

  assert.match(resultComponents, /buildSmartReportView/);
  assert.match(resultComponents, /export function ClientDeliveryLoopPanel/);
  assert.match(resultComponents, /Client Delivery Loop|客户持续交付/);
  assert.match(resultComponents, /export function SmartReportPanel/);
  assert.match(resultComponents, /Smart Report|智能交付报告/);
  assert.match(resultComponents, /Ready for outreach|可外联/);
  assert.match(resultComponents, /referral_summary/);
  assert.match(resultComponents, /Warm intro paths|可尝试引荐路径/);
  assert.match(reportPage, /SmartReportPanel/);
  assert.match(reportPage, /ClientDeliveryLoopPanel/);
  assert.match(reportPage, /ClientDeliverySnapshotPanel/);
  assert.match(reportPage, /ClientDeliveryVersionHistoryPanel/);
  assert.match(reportPage, /ClientDeliveryWeeklyArchivePanel/);
  assert.ok(reportPage.indexOf("ClientDeliveryLoopPanel") < reportPage.indexOf("SmartReportPanel"));
  assert.match(reportPage, /buildProjectShareDeliveryView/);
  assert.match(reportPage, /projectRuns/);
  assert.match(reportPage, /buildClientDeliverySnapshot/);
  assert.match(reportPage, /buildClientDeliveryVersionHistory/);
  assert.match(reportPage, /buildClientDeliveryWeeklyArchive/);
  assert.match(reportPage, /buildClientDeliveryWeeklyArchiveFromRows/);
  assert.match(reportPage, /listProjectClientDeliveryWeeklyArchives/);
  assert.match(reportPage, /upsertProjectClientDeliveryWeeklyArchive/);
  assert.match(projectSource, /client_delivery_weekly_archives/);
  assert.match(projectSource, /upsertProjectClientDeliveryWeeklyArchive/);
  assert.match(projectSource, /listProjectClientDeliveryWeeklyArchives/);
  assert.match(reportPage, /attachClientDeliveryLoopSnapshot/);
  assert.match(reportPage, /buildRoleAgentWorkspaceView/);
  assert.match(reportPage, /recordProjectRoleAgentEvent/);
  assert.match(reportPage, /client_report_view/);
  assert.match(reportPage, /verifyClientDeliveryShareAccess/);
  assert.match(reportPage, /searchParams: Promise<\{ lang\?: string; t\?: string \}>/);
  assert.match(reportPage, /invalid_share_token/);
  assert.match(reportPage, /ClientReportFeedbackForm/);
  assert.match(reportPage, /client_delivery_visibility/);
  assert.match(reportPage, /visibility\.delivery_loop/);
  assert.match(reportPage, /visibility\.smart_report/);
  assert.match(reportPage, /visibility\.candidate_details/);
  assert.match(reportPage, /visibility\.feedback_form/);
  assert.match(reportPage, /deliverySnapshot\.snapshot_id/);
  assert.match(reportPage, /versionHistory\.items\.length/);
  assert.match(projectSource, /buildClientDeliveryShareToken/);
  assert.match(projectSource, /client_delivery_share_token/);
  assert.match(projectPage, /round\.clientDeliveryReportHref/);
  assert.match(projectPage, /\\?t=/);
  assert.match(dbSource, /clientDeliveryReportHref/);
  assert.match(researchTool, /clientDeliveryReportHref/);
  assert.match(researchTool, /clientDeliveryShareHref/);
  assert.match(resultComponents, /Confirmed|已确认/);
  assert.match(dbSource, /user_id,project_id/);
  assert.match(reportPage, /<SmartReportPanel result=\{talentResult\} locale=\{locale\} \/>/);
  assert.match(reportFeedbackRoute, /verifyClientDeliveryShareAccess/);
  assert.match(reportFeedbackRoute, /buildClientReportFeedbackEvent/);
  assert.match(reportFeedbackRoute, /recordProjectRoleAgentEvent/);
  assert.match(reportFeedbackRoute, /client_delivery_feedback/);
  assert.match(reportFeedbackForm, /\/api\/reports\/\$\{reportId\}\/feedback/);
  assert.match(reportFeedbackForm, /manager_feedback/);
  assert.match(reportFeedbackForm, /needs_more_candidates|ready_to_interview/);
  assert.match(projectPage, /client_feedback_audit/);
  assert.match(projectPage, /client_feedback_audit\.history/);
  assert.match(projectPage, /client_delivery_audit/);
  assert.match(projectPage, /client_delivery_audit\.timeline/);
  assert.match(projectPage, /Client delivery audit|客户交付审计/);
  assert.match(projectPage, /Client feedback|客户反馈/);
  assert.match(projectPage, /View report|查看报告/);
  assert.match(projectPage, /client_delivery_visibility/);
  assert.match(projectPage, /Client-visible report fields|客户可见报告字段/);
});

test("client delivery audit center exposes dashboard page API and export", () => {
  const nav = readFileSync("web/components/ui/signal-ui.tsx", "utf8");
  const appPage = readFileSync("web/app/app/client-delivery/page.tsx", "utf8");
  const auditRoute = readFileSync("web/app/api/client-delivery/audit/route.ts", "utf8");
  const exportRoute = readFileSync("web/app/api/client-delivery/audit/export/route.ts", "utf8");
  const center = readFileSync("web/lib/client-delivery-audit-center.mjs", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");

  assert.match(nav, /\/app\/client-delivery/);
  assert.match(nav, /nav\.clientDelivery/);
  assert.match(appPage, /Client delivery audit|客户交付审计/);
  assert.match(appPage, /\/api\/client-delivery\/audit/);
  assert.match(appPage, /\/api\/client-delivery\/audit\/export/);
  assert.match(appPage, /weekly_archives/);
  assert.match(auditRoute, /buildClientDeliveryAuditCenterView/);
  assert.match(auditRoute, /listUserClientDeliveryAuditEvents/);
  assert.match(auditRoute, /listUserClientDeliveryWeeklyArchives/);
  assert.match(exportRoute, /buildClientDeliveryAuditCenterCsv/);
  assert.match(exportRoute, /Content-Disposition/);
  assert.match(center, /project,event_type,actor,sentiment,note,report_href,event_at,archive_id,week_start,week_end,latest_report_id/);
  assert.match(projects, /listUserClientDeliveryAuditEvents/);
  assert.match(projects, /listUserClientDeliveryWeeklyArchives/);
});

test("client portal account access is enforced for share reports and feedback", () => {
  const access = readFileSync("web/lib/report-share-access.mjs", "utf8");
  const settings = readFileSync("web/lib/outreach-settings.mjs", "utf8");
  const reportPage = readFileSync("web/app/r/[id]/page.tsx", "utf8");
  const feedbackRoute = readFileSync("web/app/api/reports/[id]/feedback/route.ts", "utf8");

  assert.match(access, /normalizeClientDeliveryAccessPolicy/);
  assert.match(access, /verifyClientDeliveryCustomerAccountAccess/);
  assert.match(settings, /client_delivery_access/);
  assert.match(reportPage, /getUser/);
  assert.match(reportPage, /verifyClientDeliveryShareAccess\(row, t,[\s\S]{0,220}viewer/);
  assert.match(feedbackRoute, /verifyClientDeliveryShareAccess\(row \? \{ \.\.\.row, id \} : null, token,[\s\S]{0,220}accessPolicy/);
});

test("live signal provider cron and background role agent runs are wired", () => {
  const config = readFileSync("web/vercel.json", "utf8");
  const liveSignalRoute = readFileSync("web/app/api/cron/live-signals/route.ts", "utf8");
  const liveSignalRunner = readFileSync("web/lib/live-signal-refresh.ts", "utf8");
  const roleAgentRoute = readFileSync("web/app/api/projects/[id]/role-agent-runs/route.ts", "utf8");
  const roleAgentRunner = readFileSync("web/lib/role-agent-runner.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(config, /"path": "\/api\/cron\/live-signals"/);
  assert.match(liveSignalRoute, /refreshDueLiveSignals/);
  assert.match(liveSignalRoute, /CRON_SECRET/);
  assert.match(liveSignalRunner, /buildRoleAgentWorkspaceView/);
  assert.match(liveSignalRunner, /LIVE_SIGNAL_PROVIDER_URL/);
  assert.match(liveSignalRunner, /createHttpLiveSignalProvider/);
  assert.match(roleAgentRoute, /runRoleAgentProjectAction/);
  assert.match(roleAgentRoute, /prepare_outreach/);
  assert.match(roleAgentRunner, /runRoleAgentRunCore/);
  assert.match(roleAgentRunner, /runBulkContactResolution/);
  assert.match(roleAgentRunner, /approveOutreachDraft/);
  assert.match(projectPage, /\/api\/projects\/\$\{project\.id\}\/role-agent-runs/);
});

test("inbox-to-interview pipeline exposes two-sided message history", () => {
  const messageHistory = readFileSync("web/lib/message-history.mjs", "utf8");
  const inbox = readFileSync("web/lib/inbox.ts", "utf8");
  const inboxAgent = readFileSync("web/lib/inbox-agent.mjs", "utf8");
  const workspace = readFileSync("web/lib/role-agent-workspace.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(messageHistory, /buildTwoSidedMessageHistory/);
  assert.match(messageHistory, /message_history_events/);
  assert.match(messageHistory, /persistedActionMessages/);
  assert.match(inbox, /buildTwoSidedMessageHistory/);
  assert.match(inboxAgent, /message_history/);
  assert.match(workspace, /message_history/);
  assert.match(projectPage, /Message history|消息历史/);
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
  assert.match(route, /buildProjectCandidateGraphView\(user\.id, id\)/);
  assert.match(route, /candidateGraph/);
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
  assert.match(pureLib, /calendar\.freebusy/);
  assert.match(pureLib, /calendar\.events/);
  assert.match(gmailLib, /can_read_calendar/);
  assert.match(gmailLib, /can_create_calendar_event/);
  assert.doesNotMatch(pureLib, /gmail\.modify/);
  assert.match(tokenLib, /gmail_reconnect_required/);
  assert.doesNotMatch(tokenLib, /console\.log|console\.error/);
});

test("calendar availability route stays server-side and Role Workspace renders scheduling draft controls", () => {
  const route = readFileSync("web/app/api/integrations/calendar/availability/route.ts", "utf8");
  const calendarLib = readFileSync("web/lib/calendar-availability.mjs", "utf8");
  const gmailLib = readFileSync("web/lib/gmail.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(route, /getUser/);
  assert.match(route, /getCalendarAvailability/);
  assert.match(route, /project_id/);
  assert.match(calendarLib, /buildCalendarFreeBusyRequest/);
  assert.match(calendarLib, /slotsFromFreeBusy/);
  assert.match(calendarLib, /buildCalendarSchedulingDraft/);
  assert.match(gmailLib, /CALENDAR_FREEBUSY_URL/);
  assert.match(gmailLib, /calendar_scope_missing/);
  assert.match(projectPage, /calendarAvailabilityById/);
  assert.match(projectPage, /generateCalendarSchedulingDraft/);
  assert.match(projectPage, /Generate scheduling draft/);
  assert.match(projectPage, /生成可约时间草稿/);
  assert.match(projectPage, /Reconnect Google Calendar/);
  assert.match(projectPage, /重新授权 Google Calendar/);
  assert.match(projectPage, /No calendar invite or email is sent/);
  assert.match(projectPage, /不会自动发送日历邀请或邮件/);
  assert.doesNotMatch(route, /GOOGLE_CLIENT_SECRET|GMAIL_TOKEN_ENCRYPTION_KEY|access_token|refresh_token/);
  assert.doesNotMatch(projectPage.match(/async function generateCalendarSchedulingDraft[\s\S]*?\n  }/)?.[0] ?? "", /\/send|\/api\/inbox\/actions\/send|\/api\/outreach-threads\/\$\{[^}]+\}\/send/);
});

test("persistent scheduling draft state saves generated draft before interview-ready handoff", () => {
  const inboxActions = readFileSync("web/lib/inbox-actions.mjs", "utf8");
  const inboxAgent = readFileSync("web/lib/inbox-agent.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const saveFn = projectPage.match(/async function saveSchedulingDraft[\s\S]*?\n  }/)?.[0] ?? "";
  const payloadFn = projectPage.match(/function inboxActionPayload[\s\S]*?\n}/)?.[0] ?? "";

  assert.match(inboxActions, /save_scheduling_draft/);
  assert.match(inboxActions, /draft_saved/);
  assert.match(inboxAgent, /saved_scheduling_draft/);
  assert.match(projectPage, /Save scheduling draft/);
  assert.match(projectPage, /保存约面草稿/);
  assert.match(projectPage, /Saved scheduling draft/);
  assert.match(projectPage, /已保存约面草稿/);
  assert.match(saveFn, /action: "save_scheduling_draft"/);
  assert.match(saveFn, /scheduling_message/);
  assert.match(payloadFn, /calendarAvailabilityById\[item\.id\]\?\.draft\.body/);
  assert.match(payloadFn, /item\.saved_scheduling_draft/);
  assert.match(projectPage, /Saving this draft does not send email or create a calendar invite/);
  assert.match(projectPage, /保存草稿不会发送邮件，也不会创建日历邀请/);
  assert.doesNotMatch(saveFn, /\/send|\/api\/inbox\/actions\/send|calendar\/v3\/events|\/events/);
});

test("calendar slot hold and confirmed writeback stay in inbox action state", () => {
  const inboxActions = readFileSync("web/lib/inbox-actions.mjs", "utf8");
  const inboxAgent = readFileSync("web/lib/inbox-agent.mjs", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const route = readFileSync("web/lib/inbox-actions-route.mjs", "utf8");
  const apiRoute = readFileSync("web/app/api/inbox/actions/route.ts", "utf8");
  const gmailLib = readFileSync("web/lib/gmail.ts", "utf8");
  const holdFn = projectPage.match(/async function holdCalendarSlot[\s\S]*?\n  }/)?.[0] ?? "";
  const confirmFn = projectPage.match(/async function confirmInterviewEvent[\s\S]*?\n  }/)?.[0] ?? "";
  const rescheduleFn = projectPage.match(/async function rescheduleInterviewEvent[\s\S]*?\n  }/)?.[0] ?? "";
  const cancelFn = projectPage.match(/async function cancelInterviewEvent[\s\S]*?\n  }/)?.[0] ?? "";

  assert.match(inboxActions, /hold_calendar_slot/);
  assert.match(inboxActions, /confirm_interview_event/);
  assert.match(inboxActions, /reschedule_interview_event/);
  assert.match(inboxActions, /cancel_interview_event/);
  assert.match(inboxActions, /slot_held/);
  assert.match(inboxActions, /rescheduled/);
  assert.match(inboxActions, /canceled/);
  assert.match(inboxActions, /calendar_event_id/);
  assert.match(inboxAgent, /calendarAvailabilityFromAction/);
  assert.match(inboxAgent, /interviewEventFromAction/);
  assert.match(projectPage, /Hold first slot/);
  assert.match(projectPage, /暂留首个时间/);
  assert.match(projectPage, /Confirm interview/);
  assert.match(projectPage, /确认面试/);
  assert.match(projectPage, /Reschedule event/);
  assert.match(projectPage, /改期事件/);
  assert.match(projectPage, /Cancel event/);
  assert.match(projectPage, /取消事件/);
  assert.match(route, /calendar_slot: body\.calendar_slot/);
  assert.match(route, /calendar_event_id: calendarEventId/);
  assert.match(route, /createCalendarEvent/);
  assert.match(route, /updateCalendarEvent/);
  assert.match(route, /cancelCalendarEvent/);
  assert.match(apiRoute, /createCalendarInterviewEvent/);
  assert.match(apiRoute, /updateCalendarInterviewEvent/);
  assert.match(apiRoute, /cancelCalendarInterviewEvent/);
  assert.match(gmailLib, /CALENDAR_EVENT_INSERT_URL/);
  assert.match(gmailLib, /buildCalendarEventInsertRequest/);
  assert.match(gmailLib, /buildCalendarEventPatchRequest/);
  assert.match(gmailLib, /buildCalendarEventDeleteRequest/);
  assert.match(confirmFn, /confirm_interview_event/);
  assert.match(rescheduleFn, /reschedule_interview_event/);
  assert.match(cancelFn, /cancel_interview_event/);
  assert.doesNotMatch(`${holdFn}\n${confirmFn}\n${rescheduleFn}\n${cancelFn}`, /\/send|\/api\/inbox\/actions\/send/);
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
  assert.match(inboxActions, /message_history_events/);
  assert.match(inboxActions, /signalhire-inbox-action/);
  assert.match(inboxActionsRoute, /runInboxAction/);
  assert.match(inboxActionsRoute, /getOutreachThread/);
  assert.match(inboxActionsRoute, /updateOutreachThread/);
  assert.match(syncRoute, /syncGmailInboxForProject/);
  assert.match(projectRoute, /buildProjectInboxQueueView\(user\.id, id\)/);
  assert.match(projectRoute, /inboxQueue/);
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
  assert.match(projectPage, /Interested replies/);
  assert.match(projectPage, /有意向回复/);
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

test("outreach readiness combined action resolves contacts before approving drafts without sending", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const helper = readFileSync("web/lib/outreach-readiness.mjs", "utf8");

  assert.match(helper, /selectOutreachReadinessTargets/);
  assert.match(helper, /buildOutreachApprovalOutcome/);
  assert.match(projectPage, /Resolve & approve ready/);
  assert.match(projectPage, /解析并批准可发送草稿/);
  assert.match(projectPage, /prepareOutreachReadyDrafts/);
  assert.match(projectPage, /\/api\/contact-resolution\/bulk/);
  assert.match(projectPage, /selectOutreachReadinessTargets/);
  assert.match(projectPage, /buildOutreachApprovalOutcome/);
  assert.match(projectPage, /approvalOutcome/);
  assert.match(projectPage.match(/async function prepareOutreachReadyDrafts[\s\S]*?\n  }/)?.[0] ?? "", /try \{[\s\S]*?await fetch\(`\/api\/outreach-threads\/\$\{id\}`/);
  assert.match(projectPage.match(/async function prepareOutreachReadyDrafts[\s\S]*?\n  }/)?.[0] ?? "", /catch \(error\)[\s\S]*failed\.push/);
  assert.match(projectPage, /Approved \$\{approvalOutcome\.approved\} ready drafts/);
  assert.match(projectPage, /已批准 \$\{approvalOutcome\.approved\} 条可发送草稿/);
  assert.match(projectPage, /No emails were sent/);
  assert.match(projectPage, /未发送邮件/);
  assert.match(projectPage, /disabled=\{contactBulkBusy \|\| prepareBusy \|\| approvalRetryBusy \|\| contactProvider\?\.enabled === false \|\| items\.length === 0\}/);
  assert.match(projectPage, /disabled=\{prepareBusy \|\| contactBulkBusy \|\| approvalRetryBusy \|\| contactProvider\?\.enabled === false \|\| items\.length === 0\}/);
  assert.doesNotMatch(projectPage.match(/async function prepareOutreachReadyDrafts[\s\S]*?\n  }/)?.[0] ?? "", /\/api\/outreach-threads\/\$\{[^}]+\}\/send|\/api\/inbox\/actions\/send/);
});

test("approval retry only re-approves failed drafts without resolving contacts or sending", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const helper = readFileSync("web/lib/outreach-readiness.mjs", "utf8");
  const retryFn = projectPage.match(/async function retryFailedApprovals[\s\S]*?\n  }/)?.[0] ?? "";

  assert.match(helper, /selectOutreachApprovalRetryTargets/);
  assert.match(projectPage, /selectOutreachApprovalRetryTargets/);
  assert.match(projectPage, /retryFailedApprovals/);
  assert.match(projectPage, /approvalOutcome\.failed_items/);
  assert.match(projectPage, /Retry failed approvals/);
  assert.match(projectPage, /重试失败批准/);
  assert.match(retryFn, /buildOutreachApprovalOutcome/);
  assert.match(retryFn, /await fetch\(`\/api\/outreach-threads\/\$\{id\}`/);
  assert.match(retryFn, /catch \(error\)[\s\S]*failed\.push/);
  assert.doesNotMatch(retryFn, /\/api\/contact-resolution\/bulk/);
  assert.doesNotMatch(retryFn, /\/api\/outreach-threads\/\$\{[^}]+\}\/send|\/api\/inbox\/actions\/send/);
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

test("project network seeds persist and feed referral path views", () => {
  const migration = readFileSync("migrations/20260630142000_project_network_seeds.sql", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const seedsRoute = readFileSync("web/app/api/projects/[id]/network-seeds/route.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(migration, /add column if not exists network_seeds jsonb not null default '\[\]'::jsonb/);
  assert.match(projects, /network_seeds/);
  assert.match(projects, /updateProjectNetworkSeeds/);
  assert.match(projects, /buildProjectReferralPathView/);
  assert.match(projectRoute, /buildProjectReferralPathView\(user\.id, id, locale\)/);
  assert.match(projectRoute, /referralPaths/);
  assert.match(seedsRoute, /updateProjectNetworkSeeds/);
  assert.match(seedsRoute, /network_seeds/);
  assert.match(projectPage, /parseNetworkSeedCsv/);
  assert.match(projectPage, /NetworkReferralPathsPanel/);
  assert.match(projectPage, /\/api\/projects\/\$\{projectId\}\/network-seeds/);
  assert.match(projectPage, /referralPaths/);
});

test("ATS-lite exposes Greenhouse import and candidate export preview", () => {
  const atsCore = readFileSync("web/lib/ats-lite.mjs", "utf8");
  const statusRoute = readFileSync("web/app/api/ats-lite/status/route.ts", "utf8");
  const importRoute = readFileSync("web/app/api/ats-lite/jobs/import/route.ts", "utf8");
  const exportRoute = readFileSync("web/app/api/ats-lite/candidates/export/route.ts", "utf8");
  const shortlist = readFileSync("web/lib/shortlist.ts", "utf8");
  const settingsPage = readFileSync("web/app/app/settings/page.tsx", "utf8");
  const projectsPage = readFileSync("web/app/app/projects/page.tsx", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(atsCore, /ATS_LITE_PROVIDER = "greenhouse"/);
  assert.match(atsCore, /GREENHOUSE_API_KEY/);
  assert.match(statusRoute, /buildAtsLiteProviderStatus/);
  assert.match(importRoute, /mockGreenhouseJob/);
  assert.match(importRoute, /createProject/);
  assert.match(exportRoute, /getItem/);
  assert.match(exportRoute, /buildAtsCandidateExportPayload/);
  assert.match(shortlist, /export async function getItem/);
  assert.match(settingsPage, /\/api\/ats-lite\/status/);
  assert.match(projectsPage, /\/api\/ats-lite\/jobs\/import/);
  assert.match(projectsPage, /Import from ATS|从 ATS 导入/);
  assert.match(projectPage, /\/api\/ats-lite\/candidates\/export/);
  assert.match(projectPage, /Export to ATS|导出到 ATS/);
});

test("role workspace exposes sequence analytics without open tracking pixels", () => {
  const analytics = readFileSync("web/lib/sequence-analytics.mjs", "utf8");
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const digest = readFileSync("web/lib/outreach-activity-digest.mjs", "utf8");

  assert.match(analytics, /buildSequenceAnalyticsView/);
  assert.match(analytics, /open_tracking_available: false/);
  assert.doesNotMatch(analytics, /tracking pixel|open pixel|pixel/i);
  assert.match(projectRoute, /buildSequenceAnalyticsView/);
  assert.match(projectRoute, /sequenceAnalytics/);
  assert.match(projectPage, /SequenceAnalyticsPanel/);
  assert.match(projectPage, /sequenceAnalytics=\{detail\.sequenceAnalytics\}/);
  assert.ok(projectPage.indexOf("<GmailOutreachPanel") < projectPage.indexOf("<SequenceAnalyticsPanel"));
  assert.ok(projectPage.indexOf("<SequenceAnalyticsPanel") < projectPage.indexOf("<InboxAgentPanel"));
  assert.match(digest, /Sequence analytics/);
});

test("role workspace renders P0 role agent workspace actions before candidate modules", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const workspace = readFileSync("web/lib/role-agent-workspace.mjs", "utf8");
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");

  assert.match(projectPage, /buildRoleAgentWorkspaceView/);
  assert.match(projectPage, /RoleAgentWorkspaceView/);
  assert.match(projectPage, /roleAgentWorkspace/);
  assert.match(projectPage, /candidateGraph=\{detail\.candidateGraph\}/);
  assert.match(projectPage, /leadPreview=\{detail\.leadPreview\}/);
  assert.match(projectPage, /inboxQueue=\{detail\.inboxQueue\}/);
  assert.match(projectPage, /roleAgentMetrics=\{detail\.project\.inbox_sync_summary\}/);
  assert.match(projectRoute, /listClientDeliveryAuditEvents/);
  assert.match(projectRoute, /clientDeliveryAuditEvents/);
  assert.match(projectPage, /clientDeliveryAuditEvents=\{detail\.clientDeliveryAuditEvents/);
  assert.match(projectPage, /clientDeliveryAuditEvents,/);
  assert.match(workspace, /outreach_followup_summary/);
  assert.match(workspace, /sequence_audit/);
  assert.match(projectPage, /smartReport=\{latestSmartReportResult\}/);
  assert.match(projectPage, /searchTasks=\{detail\.searchTasks/);
  assert.match(projectPage, /delivery_summary/);
  assert.match(projectPage, /Client delivery|客户交付/);
  assert.match(projectPage, /why_now/);
  assert.match(projectPage, /signal_refresh/);
  assert.match(projectPage, /Why now|现在优先联系/);
  assert.match(projectPage, /signal_sources/);
  assert.match(projectPage, /signal_contract/);
  assert.match(workspace, /expires_at/);
  assert.match(workspace, /signalFreshness/);
  assert.match(workspace, /buildSignalRefresh/);
  assert.match(projectPage, /autopilot_path/);
  assert.match(projectPage, /Autopilot path|自动推进路径/);
  assert.match(projectPage, /autopilot_recovery/);
  assert.match(projectPage, /Recovery history|恢复历史/);
  assert.match(projectPage, /Retryable failed items|可重试失败项/);
  assert.match(projectPage, /Latest execution|最近执行/);
  assert.match(projectPage, /inbox_pipeline/);
  assert.match(projectPage, /Inbox-to-interview|收件箱到约面/);
  assert.match(workspace, /inboxPipelineSchedulingState/);
  assert.match(projectPage, /Scheduling|待约面/);
  assert.match(projectPage, /Confirmed|已确认/);
  assert.match(projectPage, /needs_recovery/);
  assert.match(workspace, /confirmed/);
  assert.match(workspace, /calendar_event_id/);
  assert.match(projectPage, /roleAgentInboxActionPayload/);
  assert.match(projectPage, /\/api\/inbox\/actions/);
  assert.match(projectPage, /weekly_progress/);
  assert.match(projectPage, /This week|本周/);
  assert.match(projectPage, /goals_configured/);
  assert.match(projectPage, /Goals not set|未设置目标/);
  assert.match(projectPage, /roleAgentStatusTone/);
  assert.match(projectPage, /roleAgentStatusLabel/);
  assert.match(projectPage, /roleAgentBlockedReasonLabel/);
  assert.match(projectPage, /aria-disabled/);
  assert.match(projectPage, /review_required/);
  assert.match(projectPage, /next_actions/);
  assert.match(projectPage, /roleAgentActionHref/);
  assert.match(projectPage, /action\.cta/);
  assert.match(projectPage, /id="lead-preview"/);
  assert.match(projectPage, /id="gmail-outreach"/);
  assert.match(projectPage, /id="inbox-agent"/);
  assert.match(projectPage, /health\.blocked_actions/);
  assert.match(projectPage, /stale_live_signals/);
  assert.match(projectPage, /low_confidence_contact/);
  assert.match(projectPage, /unapproved_draft/);
  assert.match(projectPage, /no_preview_leads/);
  assert.match(projectPage, /no_active_search_task/);
  assert.match(projectPage, /needs_human_reply/);
  assert.match(projectPage, /activity\.slice/);
  assert.match(projectPage, /roleAgentActivityTimeLabel/);
  assert.ok(projectPage.indexOf("<RoleAgentGuardrailsPanel") < projectPage.indexOf("<LeadPreviewPanel"));
  assert.ok(projectPage.indexOf("<RoleAgentGuardrailsPanel") < projectPage.indexOf("<GmailOutreachPanel"));
});

test("role agent metrics record panel views and next action clicks", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const route = readFileSync("web/app/api/projects/[id]/role-agent-events/route.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const metrics = readFileSync("web/lib/role-agent-metrics.mjs", "utf8");

  assert.match(projectPage, /recordRoleAgentMetricEvent/);
  assert.match(projectPage, /event_type: "panel_view"/);
  assert.match(projectPage, /event_type: "next_action_click"/);
  assert.match(projectPage, /event_type: "next_action_execution"/);
  assert.match(projectPage, /const runId = recordRoleAgentActionStart/);
  assert.match(projectPage, /run_id: runId/);
  assert.match(projectPage, /action_status: "started"/);
  assert.match(projectPage, /action_status: "succeeded"/);
  assert.match(projectPage, /action_status: "failed"/);
  assert.match(projectPage, /event_type: "settings_update"/);
  assert.match(projectPage, /roleAgentSettingsActionType/);
  assert.match(projectPage, /\/role-agent-events/);
  assert.match(route, /recordProjectRoleAgentEvent/);
  assert.match(route, /event_type/);
  assert.match(route, /action_type/);
  assert.match(route, /action_status/);
  assert.match(route, /run_id/);
  assert.match(route, /workflow_step/);
  assert.match(route, /guardrail/);
  assert.match(route, /detail/);
  assert.match(route, /targets/);
  assert.match(route, /result/);
  assert.match(route, /failed_items/);
  assert.match(route, /retryable/);
  assert.match(projects, /buildRoleAgentMetricsSummary/);
  assert.match(projects, /role_agent_metrics/);
  assert.match(metrics, /next_action_clicks/);
  assert.match(metrics, /next_action_runs/);
  assert.match(metrics, /refresh_live_signals/);
});

test("role agent run sourcing action creates and runs a search task", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(projectPage, /runRoleAgentSourcingAction/);
  assert.match(projectPage, /\/api\/search-tasks/);
  assert.match(projectPage, /frequency: "manual"/);
  assert.match(projectPage, /\/api\/search-tasks\/\$\{taskId\}\/run/);
  assert.match(projectPage, /action_type: "run_sourcing"/);
  assert.match(projectPage, /action_status: "succeeded"/);
  assert.match(projectPage, /action_status: "failed"/);
});

test("role agent resolve contacts action runs bulk contact resolution", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");

  assert.match(projectPage, /runRoleAgentContactResolutionAction/);
  assert.match(projectPage, /\/api\/contact-resolution\/bulk/);
  assert.match(projectPage, /action_type: "resolve_contacts"/);
  assert.match(projectPage, /action_status: "started"/);
  assert.match(projectPage, /action_status: "succeeded"/);
  assert.match(projectPage, /action_status: "failed"/);
  assert.match(projectPage, /summary\.resolved/);
  assert.match(projectPage, /summary\.failed/);
});

test("role agent approve outreach action resolves and approves ready drafts without sending", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const actionFn = projectPage.match(/async function runRoleAgentOutreachApprovalAction[\s\S]*?\n  }/)?.[0] ?? "";

  assert.match(projectPage, /runRoleAgentOutreachApprovalAction/);
  assert.match(actionFn, /\/api\/contact-resolution\/bulk/);
  assert.match(actionFn, /selectOutreachReadinessTargets/);
  assert.match(actionFn, /await fetch\(`\/api\/outreach-threads\/\$\{id\}`/);
  assert.match(actionFn, /status: "approved"/);
  assert.match(actionFn, /approvedFirstEmailSequenceForRoleAgent/);
  assert.match(actionFn, /action_type: "approve_or_send_outreach"/);
  assert.match(actionFn, /action_status: "succeeded"/);
  assert.match(actionFn, /action_status: "failed"/);
  assert.doesNotMatch(actionFn, /\/api\/outreach-threads\/\$\{[^}]+\}\/send|\/api\/inbox\/actions\/send/);
});

test("role agent follow-up action saves Gmail drafts without sending", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const actionFn = projectPage.match(/async function runRoleAgentFollowUpAction[\s\S]*?\n  }/)?.[0] ?? "";

  assert.match(projectPage, /runRoleAgentFollowUpAction/);
  assert.match(actionFn, /status === "follow_up_due"/);
  assert.match(actionFn, /queue_state === "due"/);
  assert.match(actionFn, /await fetch\(`\/api\/outreach-threads\/\$\{item\.id\}\/draft`/);
  assert.match(actionFn, /action_type: "follow_up"/);
  assert.match(actionFn, /action_status: "succeeded"/);
  assert.match(actionFn, /action_status: "failed"/);
  assert.match(actionFn, /No emails were sent/);
  assert.doesNotMatch(actionFn, /\/api\/outreach-threads\/\$\{[^}]+\}\/send|\/api\/inbox\/actions\/send/);
});

test("role agent review interested action applies the first inbox next step", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const actionFn = extractFunctionSource(projectPage, "runRoleAgentInterestedReviewAction");

  assert.match(projectPage, /runRoleAgentInterestedReviewAction/);
  assert.match(actionFn, /inbox_pipeline\.next_steps/);
  assert.match(actionFn, /step\.can_apply/);
  assert.match(actionFn, /applyRoleAgentInboxStep\(step, runId/);
  assert.match(actionFn, /action_type: "review_interested_candidates"/);
  assert.match(actionFn, /recordRoleAgentActionStart\(actionType, action\.cta\)/);
  assert.match(actionFn, /action_status: "failed"/);
  assert.match(projectPage, /action\.type === "review_interested_candidates"/);
});

test("role agent retry failed outreach action sends failed approved threads", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const actionFn = extractFunctionSource(projectPage, "runRoleAgentRetryFailedOutreachAction");

  assert.match(projectPage, /runRoleAgentRetryFailedOutreachAction/);
  assert.match(actionFn, /send_error/);
  assert.match(actionFn, /status === "approved"/);
  assert.match(actionFn, /\/api\/outreach-threads\/\$\{item\.id\}\/send/);
  assert.match(actionFn, /recordRoleAgentActionStart\("retry_failed_outreach", action\.cta\)/);
  assert.match(actionFn, /action_type: "retry_failed_outreach"/);
  assert.match(actionFn, /action_status: "succeeded"/);
  assert.match(actionFn, /action_status: "failed"/);
  assert.match(actionFn, /failed_items: roleAgentFailedItems/);
  assert.match(actionFn, /retryable: failed\.length > 0/);
  assert.match(projectPage, /action\.type === "retry_failed_outreach"/);
});

test("role agent refresh live signals action records provider guardrail", () => {
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const actionFn = extractFunctionSource(projectPage, "runRoleAgentLiveSignalRefreshAction");

  assert.match(projectPage, /runRoleAgentLiveSignalRefreshAction/);
  assert.match(actionFn, /actionType = "refresh_live_signals"/);
  assert.match(actionFn, /roleAgentWorkspace\.signal_refresh\.targets/);
  assert.match(actionFn, /action_status: "blocked"/);
  assert.match(actionFn, /provider_not_configured/);
  assert.match(actionFn, /provider_ready: false/);
  assert.match(actionFn, /retryable: true/);
  assert.match(projectPage, /action\.type === "refresh_live_signals"/);
});

test("Profile Lead Layer productizes OpenJobs Mira as low-evidence leads", () => {
  const layer = readFileSync("web/lib/profile-lead-layer.mjs", "utf8");
  const sourceClassifier = readFileSync("web/lib/source-classifier.mjs", "utf8");
  const leadPreview = readFileSync("web/components/LeadPreviewPanel.tsx", "utf8");
  const projectRoute = readFileSync("web/app/api/projects/[id]/route.ts", "utf8");
  const projectPage = readFileSync("web/app/app/projects/[id]/page.tsx", "utf8");
  const openJobsProvider = readFileSync("web/lib/openjobs-provider.mjs", "utf8");

  assert.match(layer, /buildProfileLeadLayerView/);
  assert.match(layer, /Profile Lead Layer/);
  assert.match(layer, /evidence verification/);
  assert.doesNotMatch(layer, /database search/i);
  assert.match(sourceClassifier, /Profile lead/);
  assert.match(leadPreview, /Profile Lead Layer/);
  assert.match(projectRoute, /profileLeadLayer/);
  assert.match(projectPage, /profileLeadLayer=\{detail\.profileLeadLayer\}/);
  assert.match(projectPage, /Pull profile leads|拉取资料线索/);
  assert.match(projectPage, /evidence verification|证据核验/);
  assert.match(openJobsProvider, /overall_evidence_quality: "low"/);
  assert.match(openJobsProvider, /OpenJobs AI profile has not been independently verified by public evidence/);
});

test("client portal workspace routes and APIs are wired to customer account access", () => {
  const clientPage = readFileSync("web/app/client/page.tsx", "utf8");
  const clientProjectPage = readFileSync("web/app/client/projects/[id]/page.tsx", "utf8");
  const workspaceRoute = readFileSync("web/app/api/client-portal/workspace/route.ts", "utf8");
  const projectRoute = readFileSync("web/app/api/client-portal/projects/[id]/route.ts", "utf8");
  const feedbackRoute = readFileSync("web/app/api/client-portal/projects/[id]/feedback/route.ts", "utf8");
  const portal = readFileSync("web/lib/client-portal-workspace.mjs", "utf8");
  const portalServer = readFileSync("web/lib/client-portal.ts", "utf8");
  const projects = readFileSync("web/lib/projects.ts", "utf8");
  const access = readFileSync("web/lib/report-share-access.mjs", "utf8");
  const reportPage = readFileSync("web/app/r/[id]/page.tsx", "utf8");

  assert.match(clientPage, /\/api\/client-portal\/workspace/);
  assert.match(clientPage, /暂无被授权项目|No authorized projects/);
  assert.match(clientProjectPage, /\/api\/client-portal\/projects\/\$\{projectId\}/);
  assert.match(clientProjectPage, /Interview-ready/);
  assert.match(clientProjectPage, /Weekly archive/);
  assert.match(clientProjectPage, /Feedback/);
  assert.match(workspaceRoute, /getUser/);
  assert.match(workspaceRoute, /buildClientPortalWorkspaceView/);
  assert.match(workspaceRoute, /findClientPortalAuthorizedProjects/);
  assert.match(portalServer, /listClientPortalCandidateProjects/);
  assert.match(projectRoute, /verifyClientPortalProjectAccess/);
  assert.match(projectRoute, /buildClientPortalProjectView/);
  assert.match(feedbackRoute, /recordProjectRoleAgentEvent/);
  assert.match(feedbackRoute, /client_delivery_feedback/);
  assert.match(portal, /filterClientPortalAuthorizedProjects/);
  assert.match(portal, /buildClientPortalWorkspaceView/);
  assert.match(portal, /buildClientPortalProjectView/);
  assert.match(portal, /verifyClientDeliveryCustomerAccountAccess/);
  assert.match(projects, /listClientPortalCandidateProjects/);
  assert.match(access, /verifyClientDeliveryCustomerAccountAccess/);
  assert.match(reportPage, /verifyClientDeliveryShareAccess\(row, t, \{ viewer, accessPolicy \}\)/);
});

test("release readiness can run token-based client portal QA", () => {
  const script = readFileSync("web/scripts/verify-release-readiness.mjs", "utf8");

  assert.match(script, /SIGNALHIRE_QA_USER_ID/);
  assert.match(script, /SIGNALHIRE_QA_SESSION_TOKEN/);
  assert.match(script, /JWT_SECRET/);
  assert.match(script, /signQaJwt/);
  assert.match(script, /sh_token/);
  assert.match(script, /route:\/api\/client-portal\/workspace authenticated/);
  assert.match(script, /route:\/api\/client-portal\/projects\/\[id\] authenticated/);
  assert.match(script, /useQaSession/);
});
