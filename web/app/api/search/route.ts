import { researchStream, searchPrompt } from "@/lib/miro";
import { findCachedSearch } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 秒。Vercel 上实时搜人可能超时 → 命中缓存可秒回

// 返回流式 NDJSON: 命中缓存秒回一个 done; 否则边研究边推搜索/抓取进度。
export async function POST(req: Request) {
  let query = "";
  try { ({ query } = await req.json()); } catch {}
  if (!query?.trim()) return Response.json({ error: "缺少 query" }, { status: 400 });

  const cached = findCachedSearch(query);
  if (cached) return researchStream({ cached });
  return researchStream({ prompt: searchPrompt(query) });
}
