// /api/projects/[id]
//   GET → 项目详情 + KPI + 候选人按状态分布 + 历史搜索
//   PATCH { name?, brief?, status?, color? } → 编辑
//   DELETE → 删除 (关联候选人/历史 project_id 置 NULL, 不删除)
import {
  buildProjectCandidateGraphView,
  buildProjectLeadPreviewView,
  buildProjectReferralPathView,
  deleteProject,
  getProject,
  projectCandidateBreakdown,
  projectRuns,
  PROJECT_STATUSES,
  updateProject,
  type ProjectStatus,
} from "@/lib/projects";
import { listSearchTasks } from "@/lib/search-tasks";
import { listOutreachQueue, listOutreachThreads } from "@/lib/outreach-threads";
import { buildSequenceAnalyticsView } from "@/lib/sequence-analytics.mjs";
import { buildProfileLeadLayerView } from "@/lib/profile-lead-layer.mjs";
import { buildProjectInboxQueueView } from "@/lib/inbox";
import { ingestProjectRunCandidates } from "@/lib/shortlist";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

const VALID_STATUSES = new Set<string>(PROJECT_STATUSES);

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  if (!id) return Response.json({ error: t(locale, "api.error.missingId") }, { status: 400 });

  const [project, breakdown, runs, searchTasks, outreachQueue, outreachThreads] = await Promise.all([
    getProject(user.id, id),
    projectCandidateBreakdown(user.id, id),
    projectRuns(user.id, id, 30),
    listSearchTasks({ userId: user.id, projectId: id }),
    listOutreachQueue({ userId: user.id, projectId: id }),
    listOutreachThreads({ userId: user.id, projectId: id }),
  ]);
  if (!project) return Response.json({ error: t(locale, "api.error.projectNotFound") }, { status: 404 });
  await Promise.all(runs
    .filter((run) => run.kind === "search" && run.status === "done" && run.result)
    .map((run) => ingestProjectRunCandidates({
      userId: user.id,
      projectId: id,
      sourceRunId: run.id,
      result: run.result,
    })));
  const [freshProject, freshBreakdown] = await Promise.all([
    getProject(user.id, id),
    projectCandidateBreakdown(user.id, id),
  ]);

  const projectResponse = freshProject ?? project;
  const [inboxQueue, candidateGraph, leadPreview, referralPaths] = await Promise.all([
    buildProjectInboxQueueView(user.id, id),
    buildProjectCandidateGraphView(user.id, id),
    buildProjectLeadPreviewView(user.id, id),
    buildProjectReferralPathView(user.id, id, locale),
  ]);
  return Response.json({
    project: { ...projectResponse, inbox_sync_summary: projectResponse.inbox_sync_summary ?? {} },
    breakdown: freshBreakdown ?? breakdown,
    runs,
    searchTasks,
    outreachQueue,
    inboxQueue,
    candidateGraph,
    leadPreview,
    referralPaths,
    sequenceAnalytics: buildSequenceAnalyticsView({ roleId: id, threads: outreachThreads, locale }),
    profileLeadLayer: buildProfileLeadLayerView({ leadPreview, candidateGraph, locale }),
  });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let body: { name?: unknown; brief?: unknown; status?: unknown; color?: unknown; locale?: unknown } = {};
  try { body = await req.json(); } catch {}
  const locale = normalizeLocale(body.locale);

  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;

  const patch: {
    name?: string; brief?: string | null; status?: ProjectStatus; color?: string | null;
  } = {};
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim()) return Response.json({ error: t(locale, "api.error.invalidProjectName") }, { status: 400 });
    patch.name = body.name.trim().slice(0, 120);
  }
  if (body.brief !== undefined) {
    if (body.brief !== null && typeof body.brief !== "string") return Response.json({ error: t(locale, "api.error.invalidProjectBrief") }, { status: 400 });
    patch.brief = body.brief as string | null;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !VALID_STATUSES.has(body.status)) return Response.json({ error: t(locale, "api.error.invalidProjectStatus") }, { status: 400 });
    patch.status = body.status as ProjectStatus;
  }
  if (body.color !== undefined) {
    if (body.color !== null && typeof body.color !== "string") return Response.json({ error: t(locale, "api.error.invalidProjectColor") }, { status: 400 });
    patch.color = body.color as string | null;
  }
  if (Object.keys(patch).length === 0) return Response.json({ error: t(locale, "api.error.emptyPatch") }, { status: 400 });

  const ok = await updateProject({ userId: user.id, id, ...patch });
  if (!ok) return Response.json({ error: t(locale, "api.error.projectUpdateUnavailable") }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const { id } = await ctx.params;
  const ok = await deleteProject(user.id, id);
  if (!ok) return Response.json({ error: t(locale, "api.error.projectDeleteUnavailable") }, { status: 404 });
  return Response.json({ ok: true });
}
