// worker/lib.mjs —— worker 自包含的 MiroMind 客户端 + prompt + 归一化。
// 内容与根 miro.mjs / web/lib/miro.ts 同源 (此处复制一份, 让 worker 目录可独立打进 Docker)。

import { isTalentSearchResult, normalizeTalentSearchResult } from "./talent-profile.mjs";
import { buildOpenEvidenceSourcePromptBlock } from "./open-evidence-sources.mjs";

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
    if (v === "contradicted" && cl.claim_category === "education" && cl.evidence.length === 0) {
      v = "unverified";
      cl.education_check_status = "public_insufficient";
    }
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
export const DEFAULT_PLATFORM_LANGUAGE = "Chinese (Simplified)";

function outputLanguageRules(platformLanguage = DEFAULT_PLATFORM_LANGUAGE) {
  return `OUTPUT LANGUAGE:
- Platform language: ${platformLanguage}.
- Write all user-facing text fields in the platform language, including summary, rationale, reason, next_action, strongest_signals, uncertainties, claim, evidence.note, evidence_audit, cross_validation, risk_flags, outreach_angle, and red_flags.
- Keep JSON keys, enum values, URLs, person names, company names, code/package/model names, benchmark names, and source titles unchanged when appropriate.
- Do not paste raw source passages as the answer. Summarize or translate source evidence into the platform language.`;
}

function candidateCacheHintBlock(candidateHints = []) {
  const hints = (Array.isArray(candidateHints) ? candidateHints : []).slice(0, 5).map((hint) => {
    const name = String(hint?.name ?? "").trim();
    if (!name) return "";
    const role = String(hint?.role ?? "").trim();
    const tags = Array.isArray(hint?.vertical_tags) ? hint.vertical_tags.join(", ") : "";
    const sources = Array.isArray(hint?.source_types) ? hint.source_types.join(", ") : "";
    const terms = Array.isArray(hint?.matched_terms) ? hint.matched_terms.join(", ") : "";
    const urls = Array.isArray(hint?.evidence_urls) ? hint.evidence_urls.slice(0, 3).join(", ") : "";
    return `- ${name}${role ? ` · ${role}` : ""}${tags ? ` · tags: ${tags}` : ""}${sources ? ` · sources: ${sources}` : ""}${terms ? ` · matched: ${terms}` : ""}${urls ? ` · evidence: ${urls}` : ""}`;
  }).filter(Boolean);
  if (hints.length === 0) return "";
  return `\nCANDIDATE CACHE HINTS:\nThese are previously seen, evidence-backed candidate leads that may help with recall or adjacent pools. Re-verify every claim with current public evidence. Do not stop at these cached candidates; continue searching for new and stronger matches.\n${hints.join("\n")}\n`;
}

function openEvidenceLeadBlock(openEvidenceLeads = []) {
  const leads = (Array.isArray(openEvidenceLeads) ? openEvidenceLeads : []).slice(0, 12).map((lead) => {
    const name = String(lead?.candidate_name ?? "").trim();
    const title = String(lead?.title ?? "").trim();
    const url = String(lead?.url ?? "").trim();
    if (!name || !url) return "";
    const provider = String(lead?.provider ?? "").trim();
    const sourceType = String(lead?.source_type ?? "").trim();
    return `- ${name}${title ? ` · ${title}` : ""}${provider ? ` · ${provider}` : ""}${sourceType ? ` · ${sourceType}` : ""} · ${url}`;
  }).filter(Boolean);
  if (leads.length === 0) return "";
  return `\nOPEN-SOURCE PRECHECK LEADS:\nThese leads came from public source APIs before deep research. Treat them as recall hints only; verify identity, fit, and claims with concrete source URLs before recommending.\n${leads.join("\n")}\n`;
}

export const searchPrompt = (query, platformLanguage = DEFAULT_PLATFORM_LANGUAGE, candidateHints = [], openEvidenceLeads = []) => `You are SignalHire, an AI talent sourcing and evidence-audit agent for HR teams and headhunters.

TASK:
Search globally for 10 to 15 real AI talent candidates for this hiring brief:
"${query}"
${candidateCacheHintBlock(candidateHints)}
${openEvidenceLeadBlock(openEvidenceLeads)}

The result must feel like a high-quality hiring shortlist, not raw search results.

SEARCH STRATEGY:
- Prefer public, verifiable achievement signals over resume keywords.
- Search broadly across papers, arXiv, OpenReview, Semantic Scholar, conference pages, patents, datasets, benchmarks, GitHub, Hugging Face, Papers with Code, personal sites, technical blogs, company engineering blogs, project pages, talks, podcasts, interviews, communities, and public profile pages.
- Group candidates by AI talent direction.
- Include primary matches and adjacent transferable candidates when useful.
- Every candidate must be a single real named person.
- Never return teams, organizations, unnamed contributors, or collectives.
- Do not guess private email addresses.
- Track evidence coverage in four groups: research | practice | work_history | public_voice.

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
- Source types should use: paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | other.
- "verified" means public evidence clearly supports the claim.
- "contradicted" means public evidence conflicts with the claim.
- "unverified" means the claim is plausible but not supported by clear public evidence.
- If a claim has no concrete evidence URL, use "unverified".

${buildOpenEvidenceSourcePromptBlock(query)}

${outputLanguageRules(platformLanguage)}

OUTPUT RULES:
Respond with only one JSON object and no prose.
For each search_plan.source_strategy item, include a matching source_execution.jobs item that reports whether that source family was completed, partial, failed, or still planned.
Use coverage_backfill.jobs to turn missing or weak coverage into concrete next-round source tasks.
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
        "source_type": "paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | other",
        "coverage_group": "research | practice | work_history | public_voice",
        "target": "specific platforms or source families to search",
        "query": "concrete query string or site operator plan to run for this source family",
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
  "source_execution": {
    "summary": "short audit of which source jobs were executed, which were thin, and where follow-up is needed",
    "jobs": [
      {
        "job_id": "stable id such as source-1-code",
        "source_type": "paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | other",
        "coverage_group": "research | practice | work_history | public_voice",
        "query": "exact query or source plan actually run for this source family",
        "status": "completed | partial | failed | planned",
        "urls_found": 0,
        "evidence_found": 0,
        "candidate_leads": ["candidate names first found or supported by this source job"],
        "source_urls": ["specific source URLs reviewed or used; never search-results URLs"],
        "error": "empty string unless the source job failed or produced no concrete source",
        "next_action": "follow-up search or coverage gap to run next"
      }
    ]
  },
  "coverage_backfill": {
    "summary": "short summary of the most important source coverage gaps to backfill next",
    "jobs": [
      {
        "gap_id": "stable id such as practice-code",
        "coverage_group": "research | practice | work_history | public_voice",
        "missing_source_type": "paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | other",
        "query": "concrete query string for the next backfill search",
        "reason": "why this gap matters for verification or ranking",
        "priority": 1,
        "status": "planned | completed | skipped",
        "candidate_names": ["candidate names affected by this gap"],
        "source_types_to_check": ["source families to try for this gap"]
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
    "coverage_checklist": [
      {
        "group": "research | practice | work_history | public_voice",
        "covered": true,
        "missing": ["source families still missing for this group"],
        "note": "short explanation of the coverage gap or why coverage is sufficient"
      }
    ],
    "source_mix": [
      { "source_type": "paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | other", "count": 0 }
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
            { "note": "what the source proves", "url": "https://example.com/source-page", "source_type": "paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | other" }
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

export const verifyPrompt = (bio, platformLanguage = DEFAULT_PLATFORM_LANGUAGE) => `You are a candidate fact-checking agent. Below is a candidate's SELF-DESCRIBED profile.
Extract each distinct factual claim and CROSS-VERIFY it against MULTIPLE independent
public web sources. Be skeptical — resumes commonly overstate.

VERDICT RUBRIC:
- "verified"     = 2+ independent public sources confirm the claim.
- "contradicted" = public evidence conflicts with the claim (e.g. someone else is the real
                   creator/author, the role/title/tenure is overstated, or an education claim conflicts with a concrete source).
- "unverified"   = no public evidence found either way. For education claims, this usually means "public_insufficient".
Scrutinize creator/founder/lead, seniority, tenure, and credential (degree) claims HARDEST.

VERDICT & EVIDENCE RULES (critical):
- "verdict" MUST be EXACTLY one of: "verified", "contradicted", "unverified". Never any other value. If unsure, use "unverified".
- Every evidence "url" MUST be a SPECIFIC source page that contains the fact. NEVER cite a search-results URL (nothing with google.com/search, bing.com/search, or a "?q=" query). If no concrete page exists, mark the claim "unverified".
- Do not mark education claims as "contradicted" solely because no public source is found.
- Only mark an education claim "contradicted" when a specific public source, candidate-provided verification, employer-ordered verification, or manual HR attestation conflicts with the claim.

EDUCATION CLAIM RULES (critical):
- For school, department, major, degree, education level, attendance dates, graduation dates, scholarships, honors, exchange programs, and joint training, set "claim_category": "education".
- First run a public-source precheck. Use public school/department/graduate-school pages, admissions/admitted-student notices, award notices, graduation/defense/thesis pages, lab/member/advisor pages, thesis repositories, public papers, personal pages, LinkedIn, GitHub, Gitee, Google Scholar, ORCID, and DBLP.
- Do not scrape or submit forms for databases that require login, captcha, report number, payment, account access, or candidate consent. CHSI, Ministry of Education degree queries, HEDD, NSC, My eQuals, and similar systems are formal verification paths only when legal verification material or authorization is provided.
- Use "education_check_status" EXACTLY as one of: "public_supported", "public_partial", "public_insufficient", "inconsistent", "needs_formal", "formal_verified", "materials_needed".
- Use "verification_method" EXACTLY as one of: "public_evidence_search", "candidate_provided_verification", "employer_ordered_verification", "manual_hr_attestation".
- Use "source_confidence" EXACTLY as one of: "high", "medium", "low", "unknown".
- If public sources are insufficient, keep "verdict": "unverified", set "education_check_status": "public_insufficient" or "needs_formal", and explain in "recommended_next_action" that this cannot directly disprove the education claim.
- If the user provided CHSI/HEDD/NSC/My eQuals material, a verification PDF, a code/report number, or an official verification link, treat that as candidate_provided_verification or employer_ordered_verification evidence; do not store raw files in output.
- Supported education source_type values include: "school_official", "admission_notice", "award_notice", "thesis_repository", "lab_profile", "education_verification", "manual_attestation".

SUPPORTING MATERIAL RULES (critical):
- If the input includes the heading "HR-provided supporting material" or "HR 补充证明材料", treat it as HR-provided evidence for one or more related claims.
- Automatically classify the material_type as exactly one of: education_verification | work_verification | award_verification | project_verification | publication_verification | identity_verification | manual_attestation | other_supporting_material.
- Use the material to support or conflict with the related claim only when the extracted text gives concrete fields, identifiers, dates, names, links, or official/HR attestation details. Do not assume a file name alone proves a claim.

${outputLanguageRules(platformLanguage)}

OUTPUT RULES (critical): respond with ONLY one JSON object, no prose, exactly this shape:
{
  "candidate_name": "string",
  "overall_trust": "high | medium | low",
  "claims": [
    { "claim": "...",
      "verdict": "verified | contradicted | unverified",
      "claim_category": "education | work | identity | achievement | credential | other",
      "education_check_status": "public_supported | public_partial | public_insufficient | inconsistent | needs_formal | formal_verified | materials_needed",
      "verification_method": "public_evidence_search | candidate_provided_verification | employer_ordered_verification | manual_hr_attestation",
      "source_confidence": "high | medium | low | unknown",
      "missing_fields": ["school | department | major | degree | level | start_date | end_date | graduation_date | scholarship | verification_material"],
      "recommended_next_action": "short neutral next step for this claim",
      "evidence": [ { "note": "what the source shows", "url": "https://...", "source_type": "paper | code | profile | company | talk | blog | project | community | patent | dataset | benchmark | school_official | admission_notice | award_notice | thesis_repository | lab_profile | education_verification | manual_attestation | other" } ] }
  ],
  "red_flags": [ "short bullet of anything that looks exaggerated or false" ]
}

CANDIDATE SELF-DESCRIPTION:
"""
${bio}
"""`;
