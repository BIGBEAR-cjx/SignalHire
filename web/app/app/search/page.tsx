"use client";

// /app/search —— 智能搜人。
// 支持 ?q=<query> 预填 + 自动跑; ?project=<id> 项目上下文。
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ResearchTool from "@/components/ResearchTool";
import { shouldAutoRunInitialSearch } from "@/lib/search-page-state.mjs";

function SearchInner() {
  const sp = useSearchParams();
  const initialQ = sp.get("q") || "";
  const projectId = sp.get("project") || undefined;
  const autoRun = shouldAutoRunInitialSearch({ initialInput: initialQ, projectId });
  const [projectName, setProjectName] = useState<string | undefined>();

  // 在项目上下文时拉项目名 (面包屑显示)
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`).then((r) => r.ok ? r.json() : null).then((j) => {
      if (j?.project?.name) setProjectName(j.project.name);
    }).catch(() => {});
  }, [projectId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">智能搜人</h1>
        <p className="mt-1 text-sm text-gray-500">用一段自然语言描述招聘需求, MiroMind 全网帮你找候选人并核验。</p>
      </header>
      <ResearchTool mode="search" initialInput={initialQ} autoRun={autoRun} projectId={projectId} projectName={projectName} />
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
