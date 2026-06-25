import { historyRuns } from "@/lib/db";
import { normalizeLocale, t } from "@/lib/i18n.mjs";
import { listProjects } from "@/lib/projects";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/history → 当前用户研究历史, 支持筛选和项目入口。
// 多租户: 需登录, 只返本人的。
export async function GET(req: Request) {
  const url = new URL(req.url);
  const locale = normalizeLocale(url.searchParams.get("locale"));
  const user = await getUser();
  if (!user) return Response.json({ error: t(locale, "api.error.loginRequired") }, { status: 401 });
  const [history, projects] = await Promise.all([
    historyRuns(user.id, url.searchParams, locale),
    listProjects(user.id),
  ]);
  return Response.json({
    runs: history.runs,
    nextCursor: history.nextCursor,
    projects: projects.map((project) => ({ id: project.id, name: project.name })),
  });
}
