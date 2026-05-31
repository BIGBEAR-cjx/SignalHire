// lib/source-quality.ts —— 信任度可视化指标 (Phase 2.A.1)。
//
// 访谈反馈: "你信不信这些 AI 报告看?" → 必须在 UI 加可信度信号:
//   ① 每条声称的独立信源数 (不同域名)
//   ② 报告全局独立信源数
//   ③ 自我披露 (caveat)
//
// 纯函数, 无副作用, 可在 server/client 任意调。

import type { Claim, Evidence, VerifyReport } from "@/components/result";

// 提取 URL 的域名 (去 www, 失败返 fallback)
export function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// 单条 claim 的独立信源数 = evidence 数组里 url 的不同域名数
export function uniqueSourcesOf(claim: Claim): number {
  const set = new Set<string>();
  for (const e of claim.evidence ?? []) {
    const d = domainOf(e.url || "");
    if (d) set.add(d);
  }
  return set.size;
}

// 整份报告的全局独立信源数 (跨所有 claims)
export function reportUniqueSources(claims: Claim[] | undefined): number {
  const set = new Set<string>();
  for (const cl of claims ?? []) {
    for (const e of cl.evidence ?? []) {
      const d = domainOf(e.url || "");
      if (d) set.add(d);
    }
  }
  return set.size;
}

// 信任程度文案 — 由独立信源数和声称数推断 (启发式, 不是硬数据)
export function trustHeuristic(report: VerifyReport): {
  level: "strong" | "moderate" | "thin";
  label: string;
  hint: string;
} {
  const uniq = reportUniqueSources(report.claims);
  const total = report.claims?.length ?? 0;
  // 启发式: 每条声称平均 ≥ 1.5 个独立信源 = 强证据; ≥ 1 = 一般; < 1 = 薄
  const ratio = total > 0 ? uniq / total : 0;
  if (ratio >= 1.5) return { level: "strong", label: "证据较厚", hint: "多数声称有多个独立信源支撑" };
  if (ratio >= 1.0) return { level: "moderate", label: "证据中等", hint: "大部分声称有信源, 但密度不高" };
  return { level: "thin", label: "证据偏薄", hint: "信源稀疏, 谨慎做决策依据" };
}

// 用 trust level 选 chip 样式
export function trustHeuristicChip(level: "strong" | "moderate" | "thin"): string {
  if (level === "strong") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (level === "moderate") return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-700 ring-rose-200";
}

// 单条 claim 的"独立信源 X 个"badge 颜色
export function sourceCountChip(n: number): string {
  if (n >= 3) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (n >= 2) return "bg-amber-50 text-amber-800 ring-amber-200";
  if (n >= 1) return "bg-gray-100 text-gray-600 ring-gray-200";
  return "bg-rose-50 text-rose-700 ring-rose-200"; // 0 source 红警 (verdict 通常是 unverified)
}

// "X 处独立信源" 文案
export function sourceCountLabel(n: number): string {
  if (n === 0) return "无来源";
  return `${n} 处独立信源`;
}

// 复用 Evidence type
export type { Evidence };
