// lib/cache.ts —— 搜人模式的预缓存结果。
// 为什么要缓存: 实时深度搜人要 ~4-10 分钟, demo 现场不可能等; 且 Vercel serverless 会超时。
// 示例芯片点一下 → 秒出已验证过的结果; 自由输入也先查缓存, 命中就秒回, 兜底 API 挂掉。
//
// 这些 JSON 由引擎跑出 + normalizeResult 清洗过 (verdict 合法、无搜索链接假证据)。
// 加新缓存: 把 cache 结果 (含 candidates) 放到 web/data/, 在 SEARCH_SAMPLES 登记一条。
// 纯数据 + 匹配逻辑, 不引服务端代码 → 客户端(芯片)和服务端(route)都能 import。

import rust from "@/data/senior-rust.json";
import pm from "@/data/ai-recruiting-pm.json";

// 缓存数据的形状和 /api/search 返回的 data 一致 (至少含 candidates[])。
export type CachedSearch = { query?: string; candidates: unknown[] };

export interface SearchSample {
  label: string; // 芯片上显示的短标题
  query: string; // 对应的自然语言需求 (芯片点击会用它)
  data: CachedSearch;
}

export const SEARCH_SAMPLES: SearchSample[] = [
  {
    label: "Rust / Tokio 工程师",
    query: "Senior Rust engineer who has contributed to the Tokio project",
    data: rust as CachedSearch,
  },
  {
    label: "AI 招聘平台 PM",
    query: "Product manager who has worked on an AI recruiting / hiring platform",
    data: pm as CachedSearch,
  },
];

// 把输入拆成词集合 (忽略大小写/标点/常见虚词), 用于模糊匹配。
const STOP = new Set([
  "a", "an", "the", "who", "has", "have", "with", "on", "of", "for", "and",
  "to", "in", "at", "is", "was", "工程师", "找", "一个", "做过",
]);
function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9一-龥]+/g, " ")
      .split(" ")
      .filter((w) => w.length > 1 && !STOP.has(w)),
  );
}
function flatten(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9一-龥]+/g, " ").trim();
}

// 找匹配缓存: 完全相等优先, 否则按"输入词命中缓存 query 的比例"打分,
// 命中 ≥2 个词且比例 ≥0.5 即算匹配 —— 让换种说法/调换词序也能命中。
export function findCachedSearch(query: string): CachedSearch | null {
  const qf = flatten(query);
  if (!qf) return null;
  for (const s of SEARCH_SAMPLES) if (flatten(s.query) === qf) return s.data;

  const qt = tokens(query);
  if (qt.size === 0) return null;
  let best: { score: number; data: CachedSearch } | null = null;
  for (const s of SEARCH_SAMPLES) {
    const st = tokens(s.query);
    let hit = 0;
    for (const w of qt) if (st.has(w)) hit++;
    const score = hit / qt.size;
    if (hit >= 2 && score >= 0.5 && (!best || score > best.score)) {
      best = { score, data: s.data };
    }
  }
  return best?.data ?? null;
}
