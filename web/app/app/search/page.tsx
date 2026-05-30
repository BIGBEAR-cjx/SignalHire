"use client";

// /app/search —— 智能搜人。
// 支持 ?q=<query> 从营销首页 hero 跳过来时自动预填 + 自动跑。
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ResearchTool from "@/components/ResearchTool";

function SearchInner() {
  const sp = useSearchParams();
  const initialQ = sp.get("q") || "";
  const autoRun = Boolean(initialQ);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">智能搜人</h1>
        <p className="mt-1 text-sm text-gray-500">用一段自然语言描述招聘需求, MiroMind 全网帮你找候选人并核验。</p>
      </header>
      <ResearchTool mode="search" initialInput={initialQ} autoRun={autoRun} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">加载中…</div>}>
      <SearchInner />
    </Suspense>
  );
}
