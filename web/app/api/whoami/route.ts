// GET /api/whoami → 当前登录用户的 {id, email}。用于:
// 1. 控制台设置页展示 (方便复制 user_id 拿来做 SQL migration backfill)
// 2. 部署后健康自检
// 未登录 → 401。
import { getUser } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "未登录" }, { status: 401 });
  return Response.json({ user });
}
