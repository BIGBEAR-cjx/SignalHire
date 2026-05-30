// /api/overview —— 控制台总览 dashboard 一次拉全。
// 返回: { kpi, active_jobs, recent } —— 减少前端往返, 一次 fetch 完事。
// 需登录, 按 user.id 隔离。
import { overviewStats, activeJobs, recentRuns } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  const [kpi, active_jobs, recent] = await Promise.all([
    overviewStats(user.id),
    activeJobs(user.id, 10),
    recentRuns(user.id, 5),
  ]);

  return Response.json({ kpi, active_jobs, recent });
}
