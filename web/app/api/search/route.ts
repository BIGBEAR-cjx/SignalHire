import { streamResearch, parseJson, normalizeResult, withRetry, searchPrompt } from "@/lib/miro";
import { findCachedSearch } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 秒。本地不限; Vercel 上搜人可能超时 → 命中缓存可秒回

export async function POST(req: Request) {
  let query = "";
  try { ({ query } = await req.json()); } catch {}
  if (!query?.trim()) return Response.json({ error: "缺少 query" }, { status: 400 });

  // 先查预缓存: 命中就秒回 (demo 用, 也兜底实时 API 超时/挂掉)。
  const cached = findCachedSearch(query);
  if (cached) {
    return Response.json({ data: cached, stats: { searches: 0, fetches: 0, cached: true } });
  }

  try {
    const out = await withRetry(() => streamResearch(searchPrompt(query)));
    const data = parseJson(out.content);
    if (!data) return Response.json({ error: "模型输出不是干净 JSON", raw: out.content }, { status: 502 });
    normalizeResult(data); // 兜底: 修非法 verdict + 删搜索链接假证据
    return Response.json({ data, stats: { searches: out.searches, fetches: out.fetches } });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
