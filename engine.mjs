// engine.mjs —— HeadHunter 引擎 (MiroMind 原生 · 流式版)
// 作用: 给一句招聘需求, 让 MiroMind 自己上网搜候选人 + 交叉验证, 输出 JSON。
//
// 为什么用流式: 深度研究要几分钟。非流式请求期间不传数据, 会被网络代理当成
// "空闲连接"掐断 (SocketError: other side closed)。流式下持续有数据, 连接不会断,
// 还能实时看到它在搜什么。
//
// 运行: node --env-file=.env.local engine.mjs "Senior Rust engineer who contributed to tokio"

const BASE = process.env.MIROMIND_BASE_URL;
const KEY = process.env.MIROMIND_API_KEY;
const MODEL = process.env.MIROMIND_MODEL;
if (!BASE || !KEY || !MODEL) {
  console.error("缺少环境变量。用: node --env-file=.env.local engine.mjs \"需求\"");
  process.exit(1);
}

const query =
  process.argv.slice(2).join(" ") ||
  "Senior Rust engineer who has contributed to the Tokio project, based in Europe";

const userPrompt = `You are a technical recruiting research agent. You source candidates AND
fact-check them honestly. Your value is catching exaggerations, not rubber-stamping resumes.

TASK: Find exactly 3 candidate engineers for this role: "${query}".

HARD RULES on who counts as a candidate:
- Each candidate MUST be a single, real, individually-named human (first + last name).
- NEVER return a team, group, organization, "contributors", or collective as a candidate.
- The 3 candidates must be 3 DIFFERENT people.

For EACH candidate, research the open web and CROSS-VERIFY their key claims against
MULTIPLE independent public sources (GitHub, personal sites, conference talks, papers,
company pages, LinkedIn). Extract 3 concrete claims per candidate and judge each:

VERDICT RUBRIC (use precisely):
- "verified"     = 2+ independent sources clearly confirm the claim.
- "contradicted" = sources directly conflict with the claim (e.g. wrong creator,
                   overstated tenure/role, claim of exclusivity that evidence disproves).
- "unverified"   = no clear public evidence either way.
Scrutinize seniority, tenure, "core/lead/creator", and exclusivity claims HARDEST —
these are the most commonly exaggerated. Never mark a claim "verified" without a source URL.

VERDICT & EVIDENCE RULES (critical):
- "verdict" MUST be EXACTLY one of: "verified", "contradicted", "unverified". Never any other value (no "partially verified"). If unsure, use "unverified".
- Every evidence "url" MUST be a SPECIFIC source page (real profile/repo/article/company page that contains the fact). NEVER cite a search-results URL (nothing with google.com/search, bing.com/search, or a "?q=" query). If no concrete page exists, mark the claim "unverified".

OUTPUT RULES (critical):
- Respond with ONLY a single JSON object. No prose before or after.
- Use exactly this shape:
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

// 发起一次流式请求, 边读边累积。返回 {content, searches, fetches, thinks, raw}
async function callStream() {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", content = "", raw = "";
  let searches = 0, fetches = 0, thinks = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    raw += chunk;
    buf += chunk;
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
        if (s.type === "web_search") {
          searches++;
          const q = s.web_search?.search_keywords ?? s.query ?? "";
          process.stderr.write(`\n🔍 搜索#${searches}: ${String(q).slice(0, 100)}`);
        } else if (s.type === "fetch_url_content") {
          fetches++;
          const u = s.fetch_url_content?.url ?? s.url ?? "";
          process.stderr.write(`\n📄 抓取#${fetches}: ${String(u).slice(0, 100)}`);
        } else if (s.type === "thinking") {
          thinks++;
          if (thinks % 40 === 0) process.stderr.write(".");
        }
      }
    }
  }
  return { content, searches, fetches, thinks, raw };
}

console.error(`需求: ${query}`);
console.error("调用 MiroMind 中 (流式, 几分钟)...");
const t0 = Date.now();

let out, lastErr;
for (let attempt = 1; attempt <= 3; attempt++) {
  try { out = await callStream(); break; }
  catch (e) {
    lastErr = e;
    console.error(`\n[第 ${attempt} 次失败: ${e.message}] ${attempt < 3 ? "重试中..." : ""}`);
  }
}
if (!out) { console.error("三次都失败:", lastErr?.message); process.exit(1); }

const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.error(
  `\n完成: 耗时 ${secs}s | 搜索 ${out.searches} | 抓取 ${out.fetches} | 思考块 ${out.thinks}`,
);

const { writeFileSync } = await import("node:fs");
writeFileSync("last_run_raw.txt", out.raw);
writeFileSync("last_run_content.txt", out.content);
console.error("(原始流已存 last_run_raw.txt, content 已存 last_run_content.txt)");

console.error("--- content ---");
let parsed = null;
try { parsed = JSON.parse(out.content); } catch {}
if (!parsed) {
  const m = out.content.match(/\{[\s\S]*\}/);
  if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
}
if (parsed) {
  const { normalizeResult } = await import("./miro.mjs");
  normalizeResult(parsed); // 兜底: 修非法 verdict + 删搜索链接假证据
  const cs = parsed.candidates ?? [];
  // Day 2 自检: 数量 / 是否有非个人 / 各 verdict 计数
  const verdicts = {};
  let groupish = 0;
  for (const c of cs) {
    for (const cl of c.claims ?? []) verdicts[cl.verdict] = (verdicts[cl.verdict] ?? 0) + 1;
    if (/contributor|team|group|maintainers|collective/i.test(c.name ?? "")) groupish++;
  }
  console.error(`✅ 合法 JSON | 候选人 ${cs.length} | 疑似非个人 ${groupish} | verdicts ${JSON.stringify(verdicts)}`);
  console.log(JSON.stringify(parsed, null, 2));
} else {
  console.error("⚠️ content 不是干净 JSON。原样打印:");
  console.log(out.content || "(空 content)");
}
