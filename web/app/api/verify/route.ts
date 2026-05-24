import { researchStream, verifyPrompt } from "@/lib/miro";
import { findCachedVerify, flatten } from "@/lib/cache";
import { findRun, findRunId, saveRun } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 300; // 验证约 2 分钟, Vercel Pro 上限内可跑

// 三层: 静态缓存 → DB 缓存 → 实时核查。实时完成时写库 (下次秒出 + 进历史)。
export async function POST(req: Request) {
  let bio = "";
  try { ({ bio } = await req.json()); } catch {}
  if (!bio?.trim()) return Response.json({ error: "缺少 bio" }, { status: 400 });

  const flatKey = flatten(bio);

  // ① 静态缓存 (demo 头牌); 同 key 若已 seed 进 DB 则带上分享 id
  const staticHit = findCachedVerify(bio);
  if (staticHit) return researchStream({ cached: staticHit, runId: await findRunId("verify", flatKey) });

  // ② DB 缓存
  const dbHit = await findRun("verify", flatKey);
  if (dbHit) return researchStream({ cached: dbHit.result, runId: dbHit.id });

  // ③ 实时核查; 完成时写库并拿回行 id
  return researchStream({
    prompt: verifyPrompt(bio),
    onDone: (data, stats) => {
      const d = data as any;
      const claims = Array.isArray(d?.claims) ? d.claims : [];
      const contra = claims.filter((c: any) => c?.verdict === "contradicted").length;
      const trust = d?.overall_trust ?? "?";
      const name = d?.candidate_name || (bio.length > 40 ? bio.slice(0, 40) + "…" : bio);
      return saveRun({
        kind: "verify",
        flatKey,
        queryText: bio,
        label: name,
        summary: `可信度 ${trust}${contra ? ` · ${contra} 矛盾` : ""}`,
        result: data,
        stats,
      });
    },
  });
}
