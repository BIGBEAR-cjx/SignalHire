// lib/miro.ts —— 调 MiroMind 流式接口 (服务端用)。两个 API route 共享。
// 必须 stream:true: 非流式几分钟不传数据会被网络代理掐断。

type StepKind = "search" | "fetch" | "think";
export type OnStep = (kind: StepKind, info?: string) => void;

export type Verdict = "verified" | "contradicted" | "unverified";

export async function streamResearch(userPrompt: string, onStep: OnStep = () => {}) {
  const BASE = process.env.MIROMIND_BASE_URL;
  const KEY = process.env.MIROMIND_API_KEY;
  const MODEL = process.env.MIROMIND_MODEL;
  if (!BASE || !KEY || !MODEL) throw new Error("缺少环境变量 (web/.env.local)");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: true, messages: [{ role: "user", content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  if (!res.body) throw new Error("无响应流");

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", content = "";
  let searches = 0, fetches = 0, thinks = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]" || !data) continue;
      let obj: any;
      try { obj = JSON.parse(data); } catch { continue; }
      const delta = obj.choices?.[0]?.delta ?? {};
      if (typeof delta.content === "string") content += delta.content;
      for (const s of delta.reasoning_steps ?? []) {
        if (s.type === "web_search") { searches++; onStep("search", String(s.web_search?.search_keywords ?? "")); }
        else if (s.type === "fetch_url_content") { fetches++; onStep("fetch", String(s.fetch_url_content?.url ?? "")); }
        else if (s.type === "thinking") { thinks++; onStep("think"); }
      }
    }
  }
  return { content, searches, fetches, thinks };
}

// content 解析成 JSON (容错: 抓第一个 {...})
export function parseJson(content: string): any {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// 带重试
export async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { last = e; }
  }
  throw last;
}

// ===== 两个模式的 prompt =====

export const searchPrompt = (query: string) => `You are a technical recruiting research agent. You source candidates AND
fact-check them honestly. Your value is catching exaggerations, not rubber-stamping resumes.

TASK: Find exactly 3 candidate engineers for this role: "${query}".

HARD RULES on who counts as a candidate:
- Each candidate MUST be a single, real, individually-named human (first + last name).
- NEVER return a team, group, organization, "contributors", or collective as a candidate.
- The 3 candidates must be 3 DIFFERENT people.

For EACH candidate, research the open web and CROSS-VERIFY their key claims against
MULTIPLE independent public sources. Extract 3 concrete claims per candidate and judge each:
- "verified"     = 2+ independent sources clearly confirm.
- "contradicted" = sources directly conflict with the claim.
- "unverified"   = no clear public evidence either way.
Scrutinize seniority, tenure, "core/lead/creator", and exclusivity claims HARDEST.
Never mark a claim "verified" without a source URL.

OUTPUT RULES (critical): respond with ONLY a single JSON object, no prose, exactly this shape:
{
  "candidates": [
    {
      "name": "First Last (a real individual)",
      "headline": "current role / one-line summary",
      "links": { "github": "url or null", "linkedin": "url or null", "other": "url or null" },
      "claims": [
        { "claim": "...", "verdict": "verified | contradicted | unverified",
          "evidence": [ { "note": "what this source shows", "url": "https://..." } ] }
      ],
      "summary": "2-sentence why-they-fit, mentioning any red flags found"
    }
  ]
}`;

export const verifyPrompt = (bio: string) => `You are a candidate fact-checking agent. Below is a candidate's SELF-DESCRIBED profile.
Extract each distinct factual claim and CROSS-VERIFY it against MULTIPLE independent
public web sources. Be skeptical — resumes commonly overstate.

VERDICT RUBRIC:
- "verified"     = 2+ independent public sources confirm the claim.
- "contradicted" = public evidence conflicts with the claim (e.g. someone else is the real
                   creator/author, the role/title/tenure is overstated, or the credential cannot be found).
- "unverified"   = no public evidence found either way.
Scrutinize creator/founder/lead, seniority, tenure, and credential (degree) claims HARDEST.

OUTPUT RULES (critical): respond with ONLY one JSON object, no prose, exactly this shape:
{
  "candidate_name": "string",
  "overall_trust": "high | medium | low",
  "claims": [
    { "claim": "...", "verdict": "verified | contradicted | unverified",
      "evidence": [ { "note": "what the source shows", "url": "https://..." } ] }
  ],
  "red_flags": [ "short bullet of anything that looks exaggerated or false" ]
}

CANDIDATE SELF-DESCRIPTION:
"""
${bio}
"""`;
