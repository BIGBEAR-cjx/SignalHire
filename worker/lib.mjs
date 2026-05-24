// worker/lib.mjs —— worker 自包含的 MiroMind 客户端 + prompt + 归一化。
// 内容与根 miro.mjs / web/lib/miro.ts 同源 (此处复制一份, 让 worker 目录可独立打进 Docker)。

export async function streamResearch(userPrompt, onStep = () => {}) {
  const BASE = process.env.MIROMIND_BASE_URL;
  const KEY = process.env.MIROMIND_API_KEY;
  const MODEL = process.env.MIROMIND_MODEL;
  if (!BASE || !KEY || !MODEL) throw new Error("缺少 MIROMIND_* 环境变量");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: true, messages: [{ role: "user", content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`MiroMind HTTP ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", content = "";
  let searches = 0, fetches = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]" || !data) continue;
      let obj;
      try { obj = JSON.parse(data); } catch { continue; }
      const delta = obj.choices?.[0]?.delta ?? {};
      if (typeof delta.content === "string") content += delta.content;
      for (const s of delta.reasoning_steps ?? []) {
        if (s.type === "web_search") { searches++; onStep("search", s.web_search?.search_keywords ?? "", searches, fetches); }
        else if (s.type === "fetch_url_content") { fetches++; onStep("fetch", s.fetch_url_content?.url ?? "", searches, fetches); }
      }
    }
  }
  return { content, searches, fetches };
}

export function parseJson(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

const VERDICTS = ["verified", "contradicted", "unverified"];
function isSearchUrl(u) {
  return typeof u === "string" && /(google|bing|duckduckgo)\.[a-z.]+\/(search|url)|[?&]q=/i.test(u);
}
function normalizeClaims(claims) {
  for (const cl of claims ?? []) {
    cl.evidence = (cl.evidence ?? []).filter((e) => e?.url && !isSearchUrl(e.url));
    let v = String(cl.verdict ?? "").toLowerCase().trim();
    if (!VERDICTS.includes(v)) v = "unverified";
    if (v === "verified" && cl.evidence.length === 0) v = "unverified";
    cl.verdict = v;
  }
}
export function normalizeResult(data) {
  if (!data || typeof data !== "object") return data;
  if (Array.isArray(data.candidates)) for (const c of data.candidates) normalizeClaims(c?.claims ?? []);
  if (Array.isArray(data.claims)) normalizeClaims(data.claims);
  return data;
}

// ===== prompt (与 web/lib/miro.ts 同款) =====
export const searchPrompt = (query) => `You are a technical recruiting research agent. You source candidates AND
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

export const verifyPrompt = (bio) => `You are a candidate fact-checking agent. Below is a candidate's SELF-DESCRIBED profile.
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
