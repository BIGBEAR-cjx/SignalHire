import { researchStream } from "@/lib/miro";
import { findCachedSearch, flatten } from "@/lib/cache";
import { findRun, findRunId, enqueue } from "@/lib/db";
import { normalizeLocale } from "@/lib/i18n.mjs";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300; // 秒。Vercel 上实时搜人可能超时 → 命中缓存可秒回

function smokeFlatKey(req: Request, flatKey: string) {
  const marker = req.headers.get("x-signalhire-verify-run-id")?.trim();
  if (!marker) return flatKey;
  return `${flatKey} smoke ${marker.replace(/[^a-zA-Z0-9._:-]+/g, "").slice(0, 64)}`;
}

// 三层: 静态缓存 → DB 缓存 → 实时研究。实时完成时写库 (下次秒出 + 进历史)。
// 多租户: 需登录, 所有 DB 读写都按当前 user.id 隔离。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let query = "";
  let project_id: string | null | undefined;
  let locale = "zh";
  try {
    const body = await req.json();
    query = body.query;
    project_id = body.project_id ?? undefined;
    locale = normalizeLocale(body.locale);
  } catch {}
  if (!query?.trim()) return Response.json({ error: "缺少 query" }, { status: 400 });

  const platformLanguage = locale === "en" ? "English" : "Chinese (Simplified)";
  const flatKey = flatten(locale === "zh" ? query : `${query} ${locale}`);
  const dbFlatKey = smokeFlatKey(req, flatKey);

  // ① 静态缓存 (demo 头牌, 全局可用); 同 key 若该用户已 seed 进 DB 则带上分享 id
  const staticHit = locale === "zh" && dbFlatKey === flatKey ? findCachedSearch(query) : null;
  if (staticHit) return researchStream({ cached: staticHit, runId: await findRunId("search", flatKey, user.id) });

  // ② DB 缓存 (该用户之前完成过同一研究; DB 不可用时 findRun 返回 null, 自动跳过)
  const dbHit = await findRun("search", dbFlatKey, user.id);
  if (dbHit) return researchStream({ cached: dbHit.result, runId: dbHit.id });

  // ③ 实时研究 → 入队, 由后台 worker 跑完, 前端轮询。
  const jobId = await enqueue({
    kind: "search",
    flatKey: dbFlatKey,
    queryText: query,
    label: query.length > 60 ? query.slice(0, 60) + "…" : query,
    userId: user.id,
    projectId: project_id ?? null,
    platformLanguage,
  });
  if (!jobId) return Response.json({ error: "队列暂不可用 (DB 未配置)，请试试示例查询" }, { status: 503 });
  return Response.json({ queued: true, jobId });
}
