// /api/overview —— 控制台总览 dashboard 一次拉全。
// 返回: { kpi, active_jobs, recent, active_projects } —— 减少前端往返。
import { overviewStats, activeJobs, recentRuns } from "@/lib/db";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });

  const [kpi, active_jobs, recent, allProjects] = await Promise.all([
    overviewStats(user.id),
    activeJobs(user.id, 10),
    recentRuns(user.id, 5),
    listProjects(user.id),
  ]);

  // 顶部展示前 4 个 open 项目 (按 updated 倒序, listProjects 已排序)
  const active_projects = allProjects.filter((p) => p.status === "open").slice(0, 4);

  return Response.json({ kpi, active_jobs, recent, active_projects });
}
