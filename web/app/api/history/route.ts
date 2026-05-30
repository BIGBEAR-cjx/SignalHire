import { recentRuns } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

// GET /api/history → 当前用户最近完成的研究 (历史面板)。
// 多租户: 需登录, 只返本人的。
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });
  const runs = await recentRuns(user.id, 20);
  return Response.json({ runs });
}
