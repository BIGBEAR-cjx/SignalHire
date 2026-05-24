import { streamResearch, parseJson, normalizeResult, withRetry, verifyPrompt } from "@/lib/miro";
import { findCachedVerify } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 验证约 2 分钟, Vercel Pro 上限内可跑

export async function POST(req: Request) {
  let bio = "";
  try { ({ bio } = await req.json()); } catch {}
  if (!bio?.trim()) return Response.json({ error: "缺少 bio" }, { status: 400 });

  // 先查预缓存: 命中就秒回 (demo 头牌用, 也兜底实时 API 超时/挂掉)。
  const cached = findCachedVerify(bio);
  if (cached) {
    return Response.json({ data: cached, stats: { searches: 0, fetches: 0, cached: true } });
  }

  try {
    const out = await withRetry(() => streamResearch(verifyPrompt(bio)));
    const data = parseJson(out.content);
    if (!data) return Response.json({ error: "模型输出不是干净 JSON", raw: out.content }, { status: 502 });
    normalizeResult(data); // 兜底: 修非法 verdict + 删搜索链接假证据
    return Response.json({ data, stats: { searches: out.searches, fetches: out.fetches } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
