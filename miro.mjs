// miro.mjs —— 共享: 调 MiroMind 流式接口, 实时回调研究步骤, 返回累积结果。
// engine.mjs (搜人) 和 verify.mjs (验证) 都用这个, 后面做 Next.js 也复用。

export async function streamResearch(userPrompt, onStep = () => {}) {
  const BASE = process.env.MIROMIND_BASE_URL;
  const KEY = process.env.MIROMIND_API_KEY;
  const MODEL = process.env.MIROMIND_MODEL;
  if (!BASE || !KEY || !MODEL) throw new Error("缺少环境变量 (用 node --env-file=.env.local)");

  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    // 必须 stream:true: 非流式会被网络代理当空闲连接掐断
    body: JSON.stringify({ model: MODEL, stream: true, messages: [{ role: "user", content: userPrompt }] }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", content = "", raw = "";
  let searches = 0, fetches = 0, thinks = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    raw += chunk; buf += chunk;
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
        if (s.type === "web_search") { searches++; onStep("search", s.web_search?.search_keywords ?? ""); }
        else if (s.type === "fetch_url_content") { fetches++; onStep("fetch", s.fetch_url_content?.url ?? ""); }
        else if (s.type === "thinking") { thinks++; onStep("think"); }
      }
    }
  }
  return { content, searches, fetches, thinks, raw };
}

// 把 content 解析成 JSON (容错: 抓第一个 {...})
export function parseJson(content) {
  try { return JSON.parse(content); } catch {}
  const m = content.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// 兜底归一化 (web/lib/miro.ts 同款): verdict 只允许 3 种、删搜索链接假证据、
// verified 无具体证据则降级。同时支持搜人(candidates[].claims)和验证(顶层 claims)。
const VERDICTS = ["verified", "contradicted", "unverified"];
export function isSearchUrl(u) {
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

// 命令行用: 带重试 + 实时进度打印, 跑一个 prompt
export async function runWithProgress(label, userPrompt) {
  console.error(label);
  console.error("调用 MiroMind 中 (流式, 几分钟)...");
  const t0 = Date.now();
  let s = 0, f = 0, t = 0;
  const onStep = (kind, info) => {
    if (kind === "search") { s++; process.stderr.write(`\n🔍 搜索#${s}: ${String(info).slice(0, 100)}`); }
    else if (kind === "fetch") { f++; process.stderr.write(`\n📄 抓取#${f}: ${String(info).slice(0, 100)}`); }
    else { t++; if (t % 40 === 0) process.stderr.write("."); }
  };
  let out, lastErr;
  for (let i = 1; i <= 3; i++) {
    try { out = await streamResearch(userPrompt, onStep); break; }
    catch (e) { lastErr = e; console.error(`\n[第 ${i} 次失败: ${e.message}]`); }
  }
  if (!out) throw lastErr;
  console.error(`\n完成: 耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s | 搜索 ${out.searches} | 抓取 ${out.fetches} | 思考块 ${out.thinks}`);
  return out;
}
