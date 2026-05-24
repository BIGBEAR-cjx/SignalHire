import { researchStream, verifyPrompt } from "@/lib/miro";
import { findCachedVerify } from "@/lib/cache";

export const runtime = "nodejs";
export const maxDuration = 300; // 验证约 2 分钟, Vercel Pro 上限内可跑

// 返回流式 NDJSON: 命中缓存秒回一个 done; 否则边核查边推搜索/抓取进度。
export async function POST(req: Request) {
  let bio = "";
  try { ({ bio } = await req.json()); } catch {}
  if (!bio?.trim()) return Response.json({ error: "缺少 bio" }, { status: 400 });

  const cached = findCachedVerify(bio);
  if (cached) return researchStream({ cached });
  return researchStream({ prompt: verifyPrompt(bio) });
}
