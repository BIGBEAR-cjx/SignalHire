// worker/lib.mjs —— worker 自包含的 MiroMind 客户端 + prompt + 归一化。
// 内容与根 miro.mjs / web/lib/miro.ts 同源 (此处复制一份, 让 worker 目录可独立打进 Docker)。

import { isTalentSearchResult, normalizeTalentSearchResult } from "./talent-profile.mjs";

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
  if (isTalentSearchResult(data)) return normalizeTalentSearchResult(data);
  if (Array.isArray(data.candidates)) for (const c of data.candidates) normalizeClaims(c?.claims ?? []);
  if (Array.isArray(data.claims)) normalizeClaims(data.claims);
  return data;
}

// ===== prompt (与 web/lib/miro.ts 同款) =====
export const searchPrompt = (query) => `You are SignalHire, an AI talent sourcing and evidence-audit agent for HR teams and headhunters.

TASK:
Search globally for 10 to 15 real AI talent candidates for this hiring brief:
"${query}"

The result must feel like a high-quality hiring shortlist, not raw search results.

SEARCH STRATEGY:
- Prefer public, verifiable achievement signals over resume keywords.
- Search broadly across papers, arXiv, OpenReview, Semantic Scholar, conference pages, GitHub, Hugging Face, Papers with Code, personal sites, technical blogs, company engineering blogs, project pages, benchmark pages, talks, podcasts, interviews, and public profile pages.
- Group candidates by AI talent direction.
- Include primary matches and adjacent transferable candidates when useful.
- Every candidate must be a single real named person.
- Never return teams, organizations, unnamed contributors, or collectives.
- Do not guess private email addresses.

AI DIRECTIONS:
- AI Infrastructure / LLM Systems
- AI Research / Applied Science
- Applied AI / Agents
- ML Platform / MLOps
- Data / Evaluation / Safety
- AI Product / Solutions
- Founder / Builder

SCORING:
Return match_score from 0 to 100.
Use this weighting:
- achievement_signals: 40
- skill_match: 25
- work_history: 20
- evidence_quality: 15

EVIDENCE RULES:
- Key claims need specific source URLs.
- A search-results URL is not evidence.
- "verified" means public evidence clearly supports the claim.
- "contradicted" means public evidence conflicts with the claim.
- "unverified" means the claim is plausible but not supported by clear public evidence.
- If a claim has no concrete evidence URL, use "unverified".

OUTPUT RULES:
Respond with only one JSON object and no prose.
Use exactly this shape:
{
  "search_brief": {
    "original_query": "string",
    "target_directions": ["string"],
    "required_skills": ["string"],
    "preferred_skills": ["string"],
    "seniority": "string or null",
    "geography": "string or null",
    "evidence_preferences": ["string"],
    "exclusions": ["string"]
  },
  "search_plan": {
    "must_have": ["explicit non-negotiable criteria extracted from the brief"],
    "nice_to_have": ["preferred but not required criteria"],
    "exclusions": ["profiles or signals to avoid"],
    "source_strategy": [
      {
        "source_type": "paper | code | profile | company | talk | blog | project | community | other",
        "target": "specific platforms or source families to search",
        "reason": "why this source family matters for this brief"
      }
    ],
    "adjacent_pools": [
      {
        "pool": "adjacent candidate pool worth exploring",
        "reason": "why this pool may transfer into the role"
      }
    ]
  },
  "talent_map": [
    {
      "direction": "AI Infrastructure / LLM Systems",
      "fit": "primary | adjacent | high_potential",
      "candidate_count": 0,
      "rationale": "string"
    }
  ],
  "evidence_graph": {
    "summary": "short summary of evidence coverage, source diversity, and main verification risks",
    "source_mix": [
      { "source_type": "paper | code | profile | company | talk | blog | project | community | other", "count": 0 }
    ],
    "candidates": [
      {
        "candidate_name": "First Last",
        "independent_sources": 0,
        "source_types": ["code", "company"],
        "strongest_evidence": ["specific strongest evidence signal"],
        "weakest_evidence": ["specific weak or single-source evidence signal"],
        "cross_validation": "how independent sources agree or disagree on the core fit claims",
        "risk_flags": ["identity, recency, single-source, or contradiction risks"]
      }
    ]
  },
  "candidates": [
    {
      "name": "First Last",
      "headline": "current role / concise summary",
      "location": "city, region, country or null",
      "current_role": "string or null",
      "current_company": "string or null",
      "ai_directions": ["AI Infrastructure / LLM Systems"],
      "match_score": 0,
      "score_breakdown": {
        "achievement_signals": 0,
        "skill_match": 0,
        "work_history": 0,
        "evidence_quality": 0
      },
      "strongest_signals": ["3 to 5 concrete signals"],
      "uncertainties": ["known gaps or risks"],
      "links": {
        "github": "url or null",
        "linkedin": "url or null",
        "scholar": "url or null",
        "huggingface": "url or null",
        "website": "url or null",
        "other": "url or null"
      },
      "claims": [
        {
          "claim": "concrete factual claim",
          "verdict": "verified | contradicted | unverified",
          "evidence": [
            { "note": "what the source proves", "url": "https://example.com/source-page", "source_type": "paper | code | profile | company | talk | blog | project | other" }
          ]
        }
      ],
      "evidence_audit": {
        "verified_claims": ["string"],
        "unverified_claims": ["string"],
        "contradicted_claims": ["string"],
        "single_source_claims": ["string"],
        "identity_risks": ["string"],
        "recency_notes": ["string"],
        "overall_evidence_quality": "high | medium | low"
      },
      "outreach_angle": "one specific reason to contact this person",
      "summary": "2 sentence explanation of fit and evidence strength"
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
