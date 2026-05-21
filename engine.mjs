// engine.mjs —— HeadHunter 引擎 (MiroMind 原生版)
// 作用: 给一句招聘需求, 让 MiroMind 自己上网搜候选人 + 交叉验证其声称, 输出 JSON。
//
// 运行方式 (Node 22+):
//   node --env-file=.env.local engine.mjs "Senior Rust engineer who contributed to tokio"
//
// 注意: 深度研究很慢, 一次可能要几分钟。先用它跑通, 之后再做 UI 和缓存。

const BASE = process.env.MIROMIND_BASE_URL;
const KEY = process.env.MIROMIND_API_KEY;
const MODEL = process.env.MIROMIND_MODEL;

if (!BASE || !KEY || !MODEL) {
  console.error("缺少环境变量。请用: node --env-file=.env.local engine.mjs \"需求\"");
  process.exit(1);
}

// 招聘需求: 命令行参数, 没给就用默认演示需求
const query =
  process.argv.slice(2).join(" ") ||
  "Senior Rust engineer who has contributed to the Tokio project, based in Europe";

// 这是产品的"大脑": 让 MiroMind 找人 + 逐条交叉验证, 并只输出 JSON。
const userPrompt = `You are a technical recruiting research agent.

TASK: Find 3 real candidate engineers for this role: "${query}".

For EACH candidate, research the open web and CROSS-VERIFY their key claims
against MULTIPLE independent public sources (GitHub, personal sites, conference
talks, papers, company pages). For every claim, give a verdict and cite source URLs.

OUTPUT RULES (critical):
- Respond with ONLY a single JSON object. No prose before or after.
- Use exactly this shape:
{
  "candidates": [
    {
      "name": "string",
      "headline": "current role / one-line summary",
      "links": { "github": "url or null", "linkedin": "url or null", "other": "url or null" },
      "claims": [
        {
          "claim": "what the candidate appears to claim or is reputed for",
          "verdict": "verified | unverified | contradicted",
          "evidence": [ { "note": "what this source shows", "url": "https://..." } ]
        }
      ],
      "summary": "2-sentence why-they-fit"
    }
  ]
}`;

console.error(`需求: ${query}`);
console.error("调用 MiroMind 中... (深度研究可能要几分钟, 请耐心等)");
const t0 = Date.now();

const res = await fetch(`${BASE}/chat/completions`, {
  method: "POST",
  headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    stream: false,
    messages: [{ role: "user", content: userPrompt }],
  }),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const json = await res.json();
const msg = json.choices?.[0]?.message ?? {};
const steps = msg.reasoning_steps ?? [];
const searches = steps.filter((s) => s.type === "web_search").length;
const fetches = steps.filter((s) => s.type === "fetch_url_content").length;

console.error(
  `完成: 耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s | 网页搜索 ${searches} 次 | 抓取 ${fetches} 次 | tokens ${json.usage?.total_tokens ?? "?"}`,
);
console.error("--- 下面是 content (理想情况是 JSON) ---");
console.log(msg.content ?? "(无 content)");
