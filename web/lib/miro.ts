// lib/miro.ts —— 调 MiroMind 流式接口 (服务端用)。两个 API route 共享。
// 必须 stream:true: 非流式几分钟不传数据会被网络代理掐断。

import { buildAgentSearchStrategy, isTalentSearchResult, normalizeTalentSearchResult } from "./talent-profile.mjs";

type StepKind = "search" | "fetch" | "think";
export type OnStep = (kind: StepKind, info?: string) => void;

export type Verdict = "verified" | "contradicted" | "unverified";

type MiroReasoningStep = {
  type?: string;
  web_search?: { search_keywords?: unknown };
  fetch_url_content?: { url?: unknown };
};
type MiroStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: unknown;
      reasoning_steps?: MiroReasoningStep[];
    };
  }>;
};
type EvidenceLike = { url?: unknown; [key: string]: unknown };
type ClaimLike = { evidence?: EvidenceLike[]; verdict?: unknown; [key: string]: unknown };
type CandidateLike = { claims?: ClaimLike[]; [key: string]: unknown };
type ResultLike = {
  candidates?: CandidateLike[];
  claims?: ClaimLike[];
  [key: string]: unknown;
};

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
      let obj: MiroStreamChunk;
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
export function researchStream(opts: {
  cached?: unknown;
  prompt?: string;
  // 命中缓存/DB 时已知的行 id, 随 done 返回供前端生成分享链接 /r/[id]。
  runId?: string | null;
  // 实时研究完成时调用 (发送 done 之前), 用于把结果写进 DB 并返回该行 id。缓存路径不调用。
  // DB 无关: 具体写库逻辑由 route 注入; 失败由 onDone 内部吞掉, 不影响返回。
  onDone?: (data: unknown, stats: { searches: number; fetches: number }) => Promise<string | null | undefined>;
}): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      try {
        if (opts.cached) {
          const normalized = normalizeResult(opts.cached);
          send({ type: "done", data: normalized, stats: { searches: 0, fetches: 0, cached: true }, runId: opts.runId ?? null });
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
        const normalized = normalizeResult(data);
        // 写库 (实时结果才写) 并拿回行 id; onDone 自身已吞错, 这里再包一层确保绝不影响返回。
        let runId: string | null = null;
        if (opts.onDone) { try { runId = (await opts.onDone(normalized, { searches, fetches })) ?? null; } catch {} }
        send({ type: "done", data: normalized, stats: { searches, fetches }, runId });
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
export function parseJson(content: string): unknown {
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

function normalizeClaims(claims: ClaimLike[]): void {
  for (const cl of claims ?? []) {
    cl.evidence = (cl.evidence ?? []).filter((e) => e?.url && !isSearchUrl(e.url));
    let v = String(cl.verdict ?? "").toLowerCase().trim();
    if (!VERDICTS.includes(v as Verdict)) v = "unverified";
    if (v === "verified" && cl.evidence.length === 0) v = "unverified";
    if (v === "contradicted" && cl.claim_category === "education" && cl.evidence.length === 0) {
      v = "unverified";
      cl.education_check_status = "public_insufficient";
    }
    cl.verdict = v;
  }
}

// 同时支持搜人结果 (candidates[].claims) 和验证结果 (顶层 claims)。原地修改并返回。
export function normalizeResult<T>(data: T): T {
  if (!data || typeof data !== "object") return data;
  if (isTalentSearchResult(data)) return normalizeTalentSearchResult(data) as T;
  const d = data as ResultLike;
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

export const DEFAULT_PLATFORM_LANGUAGE = "Chinese (Simplified)";

function outputLanguageRules(platformLanguage = DEFAULT_PLATFORM_LANGUAGE) {
  return `OUTPUT LANGUAGE:
- Platform language: ${platformLanguage}.
- Write all user-facing text fields in the platform language, including summary, rationale, reason, next_action, strongest_signals, uncertainties, claim, evidence.note, evidence_audit, cross_validation, risk_flags, outreach_angle, and red_flags.
- Keep JSON keys, enum values, URLs, person names, company names, code/package/model names, benchmark names, and source titles unchanged when appropriate.
- Do not paste raw source passages as the answer. Summarize or translate source evidence into the platform language.`;
}

function openEvidenceSourcePromptBlock(query: string, strategy?: any) {
  const encoded = encodeURIComponent(query.trim().replace(/\s+/g, " ").slice(0, 160));
  const strategyLines = Array.isArray(strategy?.channels)
    ? strategy.channels.slice(0, 5).flatMap((channel: any) => Array.isArray(channel?.query_variants) ? channel.query_variants.slice(0, 2) : [])
      .map((item: string) => `- Role-aware public web query: ${item}`)
      .join("\n")
    : "";
  return `OPEN-SOURCE EVIDENCE ENRICHMENT PLAN:
Use these public API/source families as first-class source_strategy options before paid enrichment. Treat returned people as leads only; verify identity and claims with concrete source URLs.
${strategyLines ? `${strategyLines}\n` : ""}- Aggressive public web recall may use LinkedIn/X/GitHub/portfolio/content-platform/company-page search-result leads, but do not scrape login-gated pages or guess private contacts.
- GitHub repository search: https://api.github.com/search/repositories?q=${encoded}%20in%3Aname%2Cdescription%2Creadme&sort=stars&order=desc&per_page=10
- Hugging Face model search: https://huggingface.co/api/models?search=${encoded}&limit=10&sort=downloads&direction=-1
- OpenAlex works search: https://api.openalex.org/works?search=${encoded}&per-page=10&sort=relevance_score%3Adesc
- Semantic Scholar paper search: https://api.semanticscholar.org/graph/v1/paper/search?query=${encoded}&limit=10&fields=title%2Curl%2Cyear%2Cauthors%2CcitationCount
- OpenReview note search: https://api2.openreview.net/notes/search?term=${encoded}&limit=10`;
}

function agentSearchStrategyBlock(query: string) {
  const strategy = buildAgentSearchStrategy(query, { locale: platformLocale(query) });
  const channels = Array.isArray(strategy.channels) ? strategy.channels : [];
  const channelLines = channels.slice(0, 8).map((channel: any) => {
    const queries = Array.isArray(channel.query_variants) ? channel.query_variants.slice(0, 2).join(" | ") : "";
    return `- ${channel.key}: ${channel.label} · coverage=${channel.coverage_group} · source_types=${(channel.source_types || []).join(", ")} · queries=${queries}`;
  }).join("\n");
  const scoreLines = Array.isArray(strategy.score_dimensions)
    ? strategy.score_dimensions.map((item: any) => `- ${item.key}: ${item.label} (${item.weight})`).join("\n")
    : "";
  const clusterLines = Array.isArray(strategy.query_clusters)
    ? strategy.query_clusters.map((item: any) => `- ${item.key}: ${item.label}`).join("\n")
    : "";
  return { strategy, block: `INTERNET ROLE STRATEGY:
role_category: ${strategy.role_category || "software_engineering"}
role_category_label: ${strategy.role_category_label || ""}
recall_mode: ${strategy.recall_mode || "aggressive_public_web_recall"}
Channels:
${channelLines}
Query clusters:
${clusterLines}
Score dimensions:
${scoreLines}
Use the channel plan to create source mix, candidate clusters, top candidates, and next search recommendations.
Do not treat the hiring company or product as a candidate target.` };
}

function platformLocale(query: string) {
  return /[\u3400-\u9fff]/.test(query) ? "zh" : "en";
}

export const searchPrompt = (query: string, platformLanguage = DEFAULT_PLATFORM_LANGUAGE) => {
  const { strategy, block } = agentSearchStrategyBlock(query);
  return `You are SignalHire, an internet-role sourcing and evidence-audit agent for HR teams and headhunters.

TASK:
Search globally for 10 to 50 public-web candidate leads, then submit the best 10 to 15 real named people for this hiring brief:
"${query}"

The result must feel like a high-quality hiring shortlist, not raw search results.

${block}

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

${openEvidenceSourcePromptBlock(query, strategy)}

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

export const verifyPrompt = (bio: string, platformLanguage = DEFAULT_PLATFORM_LANGUAGE) => `You are a candidate fact-checking agent. Below is a candidate's SELF-DESCRIBED profile.
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
