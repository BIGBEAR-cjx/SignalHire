// verify.mjs —— 验证一个候选人的"自述声称", 出可信度报告 (打脸功能)
// 运行: node --env-file=.env.local verify.mjs "候选人自述..."  (不给参数则用内置测试 bio)
import { runWithProgress, parseJson, normalizeResult } from "./miro.mjs";
import { writeFileSync } from "node:fs";

// 内置测试 bio: 含真+假混合, 用来验证它能不能抓出矛盾。
// "创建了 Tokio" 是假的 (真正作者是 Carl Lerche) → 应判 contradicted。
const TEST_BIO = `Jordan Smith — Staff Software Engineer at Google.
I am the original creator of the Tokio asynchronous runtime for Rust, which I started in 2016.
I have 12 years of professional Rust experience and hold a PhD in Computer Science from Stanford.`;

const bio = process.argv.slice(2).join(" ") || TEST_BIO;

const prompt = `You are a candidate fact-checking agent. Below is a candidate's SELF-DESCRIBED profile.
Your job: extract each distinct factual claim and CROSS-VERIFY it against MULTIPLE independent
public web sources. Be skeptical — resumes commonly overstate.

VERDICT RUBRIC:
- "verified"     = 2+ independent public sources confirm the claim.
- "contradicted" = public evidence conflicts with the claim (e.g. someone else is the real
                   creator/author, the role/title/tenure is overstated, or the credential cannot be
                   found while a different fact is documented).
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

const out = await runWithProgress(`验证候选人:\n${bio}`, prompt);
writeFileSync("last_verify_raw.txt", out.raw);
writeFileSync("last_verify_content.txt", out.content);

const parsed = normalizeResult(parseJson(out.content));
if (parsed) {
  const v = {};
  for (const c of parsed.claims ?? []) v[c.verdict] = (v[c.verdict] ?? 0) + 1;
  console.error(`✅ 合法 JSON | overall_trust=${parsed.overall_trust} | verdicts ${JSON.stringify(v)} | red_flags ${parsed.red_flags?.length ?? 0}`);
  console.log(JSON.stringify(parsed, null, 2));
} else {
  console.error("⚠️ 不是干净 JSON, 原样打印:");
  console.log(out.content || "(空)");
}
