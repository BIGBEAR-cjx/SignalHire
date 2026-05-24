import { recentRuns } from "@/lib/db";

export const runtime = "nodejs";

// GET /api/history → 最近完成过的研究 (历史面板)。DB 不可用时返回 []。
export async function GET() {
  const runs = await recentRuns(20);
  return Response.json({ runs });
}
