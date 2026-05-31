import { researchStream } from "@/lib/miro";
import { findCachedVerify, flatten } from "@/lib/cache";
import { findRun, findRunId, enqueue } from "@/lib/db";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 300; // 验证约 2 分钟, Vercel Pro 上限内可跑

function smokeFlatKey(req: Request, flatKey: string) {
  const marker = req.headers.get("x-signalhire-verify-run-id")?.trim();
  if (!marker) return flatKey;
  return `${flatKey} smoke ${marker.replace(/[^a-zA-Z0-9._:-]+/g, "").slice(0, 64)}`;
}

// 三层: 静态缓存 → DB 缓存 → 实时核查。
// 多租户: 需登录, DB 读写按 user.id 隔离。
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let bio = "";
  let project_id: string | null | undefined;
  try {
    const body = await req.json();
    bio = body.bio;
    project_id = body.project_id ?? undefined;
  } catch {}
  if (!bio?.trim()) return Response.json({ error: "缺少 bio" }, { status: 400 });

  const flatKey = flatten(bio);
  const dbFlatKey = smokeFlatKey(req, flatKey);

  // ① 静态缓存 (demo 头牌); 同 key 若该用户已 seed 进 DB 则带上分享 id
  const staticHit = dbFlatKey === flatKey ? findCachedVerify(bio) : null;
  if (staticHit) return researchStream({ cached: staticHit, runId: await findRunId("verify", flatKey, user.id) });

  // ② DB 缓存 (该用户之前的核查)
  const dbHit = await findRun("verify", dbFlatKey, user.id);
  if (dbHit) return researchStream({ cached: dbHit.result, runId: dbHit.id });

  // ③ 实时核查 → 入队, worker 跑完, 前端轮询。
  const jobId = await enqueue({
    kind: "verify",
    flatKey: dbFlatKey,
    queryText: bio,
    label: bio.length > 40 ? bio.slice(0, 40) + "…" : bio,
    userId: user.id,
    projectId: project_id ?? null,
  });
  if (!jobId) return Response.json({ error: "队列暂不可用 (DB 未配置)，请试试示例查询" }, { status: 503 });
  return Response.json({ queued: true, jobId });
}
