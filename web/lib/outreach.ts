// lib/outreach.ts —— AI 外联邮件生成 (Phase 2.A.2)。
//
// 访谈关键信号: "找到合适候选人后, 能不能 AI 起草邮件 + 一键发?"
// 这是发现-收藏 之后的下一段最大瓶颈。
//
// 实现: 走 Insforge 的 AI 代理 (POST /api/ai/chat/completion),
// 模型 openai/gpt-4o-mini 足够快+足够好写定制开场。
//
// 输出严格 JSON {subject, body} 方便前端直接 mailto: 拼接。

const BASE = process.env.INSFORGE_API_BASE_URL;
const KEY = process.env.INSFORGE_API_KEY;

export type Tone = "friendly" | "professional" | "short" | "detailed";

export const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "professional", label: "专业",     hint: "正式商务感, 偏 senior recruiter 风格" },
  { value: "friendly",     label: "友好",     hint: "口语化, peer-to-peer, 有温度" },
  { value: "short",        label: "短而准",   hint: "3-4 句话, 直接说价值, 不寒暄" },
  { value: "detailed",     label: "详细",     hint: "多段, 提到具体作品/背景, 拉长情境" },
];

const TONE_RULES: Record<Tone, string> = {
  friendly:     "Friendly, peer-to-peer, like a developer reaching out to another developer. Use 'I' not 'we'. 80-120 words body. Casual but not unprofessional. No 'Dear', no closing 'Sincerely'.",
  professional: "Polished and respectful, like a senior recruiter at a top company. Use 'we' or 'our team'. 100-150 words body. Formal but warm. Include greeting and signature placeholder.",
  short:        "Maximum 3-4 sentences body. Get to the value prop immediately. No fluff. No formal greeting. Direct subject (no 'Hi {name}' subject).",
  detailed:     "150-220 words body. Reference 2-3 specific items from their profile (project, paper, GitHub repo, talk, etc.). Multiple short paragraphs. Show you actually read their work.",
};

export interface CandidateForOutreach {
  name?: string;
  headline?: string;
  current_role?: string | null;
  current_company?: string | null;
  location?: string | null;
  summary?: string;
  ai_directions?: string[];
  strongest_signals?: string[];
  outreach_angle?: string;
  links?: { github?: string | null; linkedin?: string | null; scholar?: string | null; website?: string | null };
  claims?: Array<{ claim: string; verdict?: string }>;
}

export interface OutreachInput {
  candidate: CandidateForOutreach;
  tone: Tone;
  roleBrief?: string;    // 可选: 招聘项目描述, 让邮件更贴需求
  senderName?: string;   // 可选: 用户自己的名字 (默认 placeholder)
}

export interface OutreachDraft {
  subject: string;
  body: string;
}

// 把候选人画像压成给模型看的摘要 (省 token + 强调最有用的部分)
function summarizeCandidate(c: CandidateForOutreach): string {
  const parts: string[] = [];
  if (c.name) parts.push(`Name: ${c.name}`);
  const role = [c.current_role, c.current_company].filter(Boolean).join(" at ");
  if (role) parts.push(`Current role: ${role}`);
  if (c.location) parts.push(`Location: ${c.location}`);
  if (c.headline) parts.push(`Headline: ${c.headline}`);
  if (c.ai_directions?.length) parts.push(`Areas: ${c.ai_directions.slice(0, 4).join(", ")}`);
  if (c.strongest_signals?.length) parts.push(`Standout signals:\n- ${c.strongest_signals.slice(0, 4).join("\n- ")}`);
  if (c.outreach_angle) parts.push(`Outreach angle (pre-computed): ${c.outreach_angle}`);
  // verified claims = 模型可以放心 reference 的事实
  const verified = (c.claims ?? []).filter((cl) => cl.verdict === "verified").slice(0, 5).map((cl) => cl.claim);
  if (verified.length) parts.push(`Verified claims:\n- ${verified.join("\n- ")}`);
  // links 给模型可以提到 (但不一定要 paste 全 url)
  const links = Object.entries(c.links ?? {}).filter(([, v]) => v).map(([k]) => k);
  if (links.length) parts.push(`Has public presence on: ${links.join(", ")}`);
  // 兜底 summary
  if (parts.length === 0 && c.summary) parts.push(`Summary: ${c.summary}`);
  return parts.join("\n");
}

// 主入口: 调 Insforge AI 端点, 返回 {subject, body}。
// 失败抛 Error, API route 负责包成 500。
export async function generateOutreach(input: OutreachInput): Promise<OutreachDraft> {
  if (!BASE || !KEY) throw new Error("Insforge AI 凭证未配置");
  const tone = input.tone;
  const sender = input.senderName?.trim() || "[Your name]";
  const profile = summarizeCandidate(input.candidate);

  const system = [
    "You are a senior tech recruiter assistant drafting personalized cold outreach emails.",
    "Your goal: write an email that does NOT feel mass-produced. Reference at least one specific signal from the candidate's profile.",
    "Output STRICT JSON with two fields: 'subject' (under 80 chars, NO emoji) and 'body' (plain text, no markdown).",
    "Body MUST end with a signature line that includes the literal string '" + sender + "' (do not replace).",
    "Body MUST NOT include any placeholder like {{...}} or [link] — if you don't know something, omit it.",
    "Write in the same language as the candidate's headline/summary (default English if unclear).",
  ].join("\n");

  const user = [
    `TONE: ${tone}`,
    `STYLE: ${TONE_RULES[tone]}`,
    input.roleBrief ? `ROLE WE'RE HIRING FOR (for context, DO NOT quote verbatim):\n${input.roleBrief.slice(0, 1000)}` : "",
    "CANDIDATE PROFILE:",
    profile || "(minimal profile, do your best with what's there)",
    "",
    "Now write the cold outreach email. Output STRICT JSON only, no prose around it:",
    '{"subject": "...", "body": "..."}',
  ].filter(Boolean).join("\n\n");

  const r = await fetch(`${BASE}/api/ai/chat/completion`, {
    method: "POST",
    headers: { "x-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });
  if (!r.ok) throw new Error(`Insforge AI HTTP ${r.status}: ${await r.text().catch(() => "")}`);
  const j = await r.json();
  const raw = (j?.text ?? j?.choices?.[0]?.message?.content ?? "") as string;
  if (!raw) throw new Error("AI 没返回内容");

  // 模型有时把 JSON 包在 ```json 块里, 兜一下
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  let parsed: { subject?: unknown; body?: unknown };
  try { parsed = JSON.parse(cleaned); }
  catch {
    // 兜底: 提取第一个 { ... } JSON 块
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`AI 输出非 JSON: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }
  const subject = String(parsed.subject ?? "").trim();
  const body = String(parsed.body ?? "").trim();
  if (!subject || !body) throw new Error("AI 输出缺 subject 或 body");
  return { subject, body };
}
