// POST /api/outreach { candidate, tone, role_brief?, sender_name? }
//   → { subject, body }
// 需登录, 不写库 (邮件草稿生成是无状态的)。
import { generateOutreach, TONES, type Tone } from "@/lib/outreach";
import { getUser } from "@/lib/session";

export const runtime = "nodejs";
export const maxDuration = 30; // gpt-4o-mini 应该 < 10s, 留 buffer

const VALID_TONES = new Set<string>(TONES.map((t) => t.value));

export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "请先登录" }, { status: 401 });

  let body: {
    candidate?: unknown;
    tone?: unknown;
    role_brief?: unknown;
    sender_name?: unknown;
  } = {};
  try { body = await req.json(); } catch {}

  if (!body.candidate || typeof body.candidate !== "object") {
    return Response.json({ error: "缺少 candidate" }, { status: 400 });
  }
  const tone = typeof body.tone === "string" && VALID_TONES.has(body.tone) ? (body.tone as Tone) : "professional";

  try {
    const draft = await generateOutreach({
      candidate: body.candidate as Parameters<typeof generateOutreach>[0]["candidate"],
      tone,
      roleBrief: typeof body.role_brief === "string" ? body.role_brief : undefined,
      senderName: typeof body.sender_name === "string" ? body.sender_name : undefined,
    });
    return Response.json(draft);
  } catch (e) {
    return Response.json({ error: (e as Error).message || "生成失败" }, { status: 500 });
  }
}
