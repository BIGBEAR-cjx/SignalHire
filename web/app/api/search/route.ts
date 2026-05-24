import { researchStream } from "@/lib/miro";
import { findCachedSearch, flatten } from "@/lib/cache";
import { findRun, findRunId, enqueue } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300; // 秒。Vercel 上实时搜人可能超时 → 命中缓存可秒回

// 三层: 静态缓存 → DB 缓存 → 实时研究。实时完成时写库 (下次秒出 + 进历史)。
export async function POST(req: Request) {
  let query = "";
  try { ({ query } = await req.json()); } catch {}
  if (!query?.trim()) return Response.json({ error: "缺少 query" }, { status: 400 });

  const flatKey = flatten(query);

  // ① 静态缓存 (demo 头牌, 永远可用); 同 key 若已 seed 进 DB 则带上分享 id
  const staticHit = findCachedSearch(query);
  if (staticHit) return researchStream({ cached: staticHit, runId: await findRunId("search", flatKey) });

  // ② DB 缓存 (之前完成过的研究; DB 不可用时 findRun 返回 null, 自动跳过)
  const dbHit = await findRun("search", flatKey);
  if (dbHit) return researchStream({ cached: dbHit.result, runId: dbHit.id });

  // ③ 实时研究太慢(4-10分钟)会超 Vercel 时限 → 入队, 立刻返回 jobId, 由后台 worker 跑完, 前端轮询。
  const jobId = await enqueue({
    kind: "search",
    flatKey,
    queryText: query,
    label: query.length > 60 ? query.slice(0, 60) + "…" : query,
  });
  if (!jobId) return Response.json({ error: "队列暂不可用 (DB 未配置)，请试试示例查询" }, { status: 503 });
  return Response.json({ queued: true, jobId });
}
