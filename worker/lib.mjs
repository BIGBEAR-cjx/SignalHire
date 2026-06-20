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

function agentSearchStrategyBlock(strategy = {}) {
  if (!strategy || typeof strategy !== "object") return "";
  const channels = (Array.isArray(strategy.channels) ? strategy.channels : []).slice(0, 6).map((channel) => {
    const label = String(channel?.label ?? "").trim();
    const reason = String(channel?.reason ?? "").trim();
    const queries = Array.isArray(channel?.query_variants) ? channel.query_variants.slice(0, 2).join(" | ") : "";
    if (!label && !queries) return "";
    const key = String(channel?.key ?? "").trim();
    return `- ${key ? `${key}: ` : ""}${label}${reason ? `: ${reason}` : ""}${queries ? ` · queries: ${queries}` : ""}`;
  }).filter(Boolean);
  const priorities = (Array.isArray(strategy.evidence_priorities) ? strategy.evidence_priorities : []).slice(0, 5).map((item) => `- ${String(item).trim()}`).filter((item) => item.length > 2);
  if (channels.length === 0 && priorities.length === 0) return "";
  const roleCategory = String(strategy.role_category ?? "").trim();
  const roleLabel = String(strategy.role_category_label ?? "").trim();
  const scoreDimensions = (Array.isArray(strategy.score_dimensions) ? strategy.score_dimensions : [])
    .slice(0, 6)
    .map((item) => `- ${String(item?.key ?? "").trim()}: ${String(item?.label ?? "").trim()} (${Number(item?.weight ?? 0) || 0})`)
    .filter((item) => item.length > 8);
  const clusters = (Array.isArray(strategy.query_clusters) ? strategy.query_clusters : [])
    .slice(0, 5)
    .map((item) => `- ${String(item?.key ?? "").trim()}: ${String(item?.label ?? "").trim()}`)
    .filter((item) => item.length > 5);
  return `\nAGENT EXECUTION STRATEGY:\nINTERNET ROLE STRATEGY:\nrole_category: ${roleCategory || "software_engineering"}\nrole_category_label: ${roleLabel}\nrecall_mode: ${String(strategy.recall_mode ?? "aggressive_public_web_recall")}\nChannels:\n${channels.join("\n")}${clusters.length ? `\nQuery clusters:\n${clusters.join("\n")}` : ""}${scoreDimensions.length ? `\nScore dimensions:\n${scoreDimensions.join("\n")}` : ""}\nUse the channel plan to create source mix, candidate clusters, top candidates, and next search recommendations.\nDo not treat the hiring company or product as a candidate target.${priorities.length ? `\nEvidence priorities:\n${priorities.join("\n")}` : ""}\n`;
}

function fallbackAgentSearchStrategy(query) {
  const isGrowth = /marketing|增长|市场|内容矩阵|小红书|twitter|tiktok|youtube/i.test(String(query ?? ""));
  if (isGrowth) {
    return {
      role_category: "growth_marketing",
      role_category_label: "增长/市场/品牌/内容",
      recall_mode: "aggressive_public_web_recall",
      channels: [
        { key: "public-profiles", label: "公开履历与职业档案", coverage_group: "work_history", source_types: ["profile", "social_profile", "company_profile"], query_variants: [`${query} LinkedIn public profile`, `${query} company team page`], reason: "核验角色、资历和职业轨迹。" },
        { key: "content-social", label: "内容平台与社媒增长", coverage_group: "public_voice", source_types: ["content_platform", "social_profile", "media"], query_variants: [`${query} 小红书 Twitter YouTube TikTok 内容平台`, `${query} LinkedIn X 公众号 增长 内容矩阵`], reason: "核验内容矩阵、社媒增长和公开影响力。" },
        { key: "growth-cases", label: "增长案例与业务结果", coverage_group: "practice", source_types: ["case_study", "company_profile", "project"], query_variants: [`${query} growth case study 增长案例 conversion`, `${query} campaign user acquisition CAC retention`], reason: "优先找有真实增长结果和转化指标的人。" },
      ],
      query_clusters: [{ key: "precise_match", label: "精准匹配", query_variants: [] }],
      score_dimensions: [{ key: "role_fit", label: "增长匹配", weight: 30 }, { key: "achievement_signals", label: "增长结果", weight: 25 }, { key: "evidence_quality", label: "证据质量", weight: 20 }],
      evidence_priorities: ["没有具体 URL 的 claim 不能标记为 verified。"],
    };
  }
  return {
    role_category: "software_engineering",
    role_category_label: "技术研发/工程",
    recall_mode: "aggressive_public_web_recall",
    channels: [
      { key: "public-profiles", label: "公开履历与职业档案", coverage_group: "work_history", source_types: ["profile", "company_profile"], query_variants: [`${query} LinkedIn public profile`, `${query} company team page`], reason: "核验角色、资历和职业轨迹。" },
      { key: "code-practice", label: "代码与工程实践", coverage_group: "practice", source_types: ["code", "repository", "project"], query_variants: [`${query} site:github.com repository contributor`, `${query} Stack Overflow 技术社区 engineering blog`], reason: "用代码、项目和技术社区记录核验工程能力。" },
    ],
    query_clusters: [{ key: "precise_match", label: "精准匹配", query_variants: [] }],
    score_dimensions: [{ key: "role_fit", label: "工程匹配", weight: 30 }, { key: "achievement_signals", label: "成果信号", weight: 25 }, { key: "evidence_quality", label: "证据质量", weight: 20 }],
    evidence_priorities: ["没有具体 URL 的 claim 不能标记为 verified。"],
  };
}

export const searchPrompt = (query, platformLanguage = DEFAULT_PLATFORM_LANGUAGE, candidateHints = [], openEvidenceLeads = [], agentSearchStrategy = null) => {
  const strategy = agentSearchStrategy || fallbackAgentSearchStrategy(query);
  return `You are SignalHire, an internet-role sourcing and evidence-audit agent for HR teams and headhunters.

TASK:
Search globally for 10 to 50 public-web candidate leads, then submit the best 10 to 15 real named people for this hiring brief:
"${query}"
${candidateCacheHintBlock(candidateHints)}
${openEvidenceLeadBlock(openEvidenceLeads)}
${agentSearchStrategyBlock(strategy)}

The result must feel like a high-quality hiring shortlist, not raw search results.

SEARCH STRATEGY:
- Prefer public, verifiable achievement signals over resume keywords.
- Search broadly across role-specific public sources: public profiles, company pages, GitHub, portfolios, product pages, content platforms, community/event pages, case studies, media, blogs, talks, papers, datasets, benchmarks, and search-visible LinkedIn/X/social profile leads.
- Group candidates by role-aware candidate clusters.
- Include primary matches and adjacent transferable candidates when useful.
- Every candidate must be a single real named person.
- Never return teams, organizations, unnamed contributors, or collectives.
- Do not guess private email addresses.
- Track evidence coverage in four groups: research | practice | work_history | public_voice.

SCORING:
Return match_score from 0 to 100.
Use the role-specific score_dimensions above, then map them into the existing score_breakdown fields for compatibility.

EVIDENCE RULES:
- Key claims need specific source URLs.
- A search-results URL is not evidence.
- Source types should use: paper | code | repository | profile | social_profile | company | company_profile | talk | blog | project | portfolio | case_study | content_platform | community | event | media | patent | dataset | benchmark | other.
- "verified" means public evidence clearly supports the claim.
- "contradicted" means public evidence conflicts with the claim.
- "unverified" means the claim is plausible but not supported by clear public evidence.
- If a claim has no concrete evidence URL, use "unverified".

${buildOpenEvidenceSourcePromptBlock(query, strategy)}

${outputLanguageRules(platformLanguage)}

OUTPUT RULES:
Respond with only one JSON object and no prose.
For each search_plan.source_strategy item, include a matching source_execution.jobs item that reports whether that source family was completed, partial, failed, or still planned.
Use coverage_backfill.jobs to turn missing or weak coverage into concrete next-round source tasks.
Use exactly this shape:
{
  "search_brief": {
    "original_query": "string",
    "role_category": "software_engineering | ai_ml_data | product_management | design_creative | growth_marketing | operations_community | sales_bd_gtm | customer_success_support | security_infra_devops | business_strategy_ops | people_finance_admin | executive_founder_leadership",
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
    ],
    "query_clusters": ["role-aware search clusters used"],
    "score_dimensions": ["role-aware scoring dimensions used"]
  },
  "candidate_pool_summary": {
    "source mix": "short source mix summary",
    "clusters": ["candidate clusters with counts"],
    "top_candidates": ["top names before final shortlist"],
    "next_search_recommendations": ["follow-up search suggestions"]
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
      "direction": "role-aware candidate cluster",
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
      "ai_directions": ["role-aware fit tags"],
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
};

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
