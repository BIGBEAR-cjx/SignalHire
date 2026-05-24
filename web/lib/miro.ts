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

// 把一次研究封装成"流式 NDJSON 响应"给前端: 每行一个 JSON 事件。
//   {"type":"step","kind":"search"|"fetch","info":"...","searches":N,"fetches":M}
//   {"type":"done","data":{...},"stats":{searches,fetches,cached?}}
//   {"type":"error","error":"..."}
// 命中缓存时只发一个 done (秒回); 否则边研究边把搜索/抓取进度推给前端 (把等待变表演)。
// 前端只需处理这一种流, 缓存与实时走同一条代码路径。
export function researchStream(opts: { cached?: unknown; prompt?: string }): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (opts.cached) {
          send({ type: "done", data: opts.cached, stats: { searches: 0, fetches: 0, cached: true } });
          return;
        }
        // 自己用去重计数 (避免分块流式导致同一步重复计数), 让 feed 计数与最终一致。
        let searches = 0, fetches = 0, lastS = "", lastF = "";
        const out = await streamResearch(opts.prompt!, (kind, info = "") => {
          if (kind === "search") {
            if (info && info === lastS) return;
            lastS = info; searches++;
            send({ type: "step", kind, info, searches, fetches });
          } else if (kind === "fetch") {
            if (info && info === lastF) return;
            lastF = info; fetches++;
            send({ type: "step", kind, info, searches, fetches });
          }
        });
        const data = parseJson(out.content);
        if (!data) { send({ type: "error", error: "模型输出不是干净 JSON" }); return; }
        normalizeResult(data);
        send({ type: "done", data, stats: { searches, fetches } });
      } catch (e) {
        send({ type: "error", error: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // 关掉反向代理缓冲, 保证逐步推送
    },
  });
}

// content 解析成 JSON (容错: 抓第一个 {...})
export function parseJson(content: string): any {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// 兜底归一化: 即使模型不听 prompt, 也保证前端拿到干净数据。
// 1) verdict 只允许 3 种, 未知一律降级 unverified (防模型自创 "partially verified")。
// 2) 删掉搜索结果页那种假证据 (google/bing 搜索、带 ?q= 的) —— 搜索链接不是佐证。
// 3) verified 但清完证据后没有任何具体来源 → 降级 unverified (没证据不算已验证)。
const VERDICTS: Verdict[] = ["verified", "contradicted", "unverified"];

export function isSearchUrl(u: unknown): boolean {
  return (
    typeof u === "string" &&
    /(google|bing|duckduckgo)\.[a-z.]+\/(search|url)|[?&]q=/i.test(u)
  );
}

function normalizeClaims(claims: any[]): void {
  for (const cl of claims ?? []) {
    cl.evidence = (cl.evidence ?? []).filter((e: any) => e?.url && !isSearchUrl(e.url));
    let v = String(cl.verdict ?? "").toLowerCase().trim();
    if (!VERDICTS.includes(v as Verdict)) v = "unverified";
    if (v === "verified" && cl.evidence.length === 0) v = "unverified";
    cl.verdict = v;
  }
}

// 同时支持搜人结果 (candidates[].claims) 和验证结果 (顶层 claims)。原地修改并返回。
export function normalizeResult<T>(data: T): T {
  const d = data as any;
  if (!d || typeof d !== "object") return data;
  if (Array.isArray(d.candidates)) for (const c of d.candidates) normalizeClaims(c?.claims ?? []);
  if (Array.isArray(d.claims)) normalizeClaims(d.claims);
  return data;
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

VERDICT & EVIDENCE RULES (critical):
- "verdict" MUST be EXACTLY one of: "verified", "contradicted", "unverified". Never any other value (no "partially verified"). If unsure, use "unverified".
- Every evidence "url" MUST be a SPECIFIC source page (a real profile, repo, article, or company page that contains the fact). NEVER cite a search-results URL (nothing with google.com/search, bing.com/search, or a "?q=" query). If you cannot find a concrete page, mark the claim "unverified".

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

VERDICT & EVIDENCE RULES (critical):
- "verdict" MUST be EXACTLY one of: "verified", "contradicted", "unverified". Never any other value. If unsure, use "unverified".
- Every evidence "url" MUST be a SPECIFIC source page that contains the fact. NEVER cite a search-results URL (nothing with google.com/search, bing.com/search, or a "?q=" query). If no concrete page exists, mark the claim "unverified".

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
