"use client";

// /app/search —— 智能搜人。
// 支持 ?q=<query> 预填 + 自动跑; ?project=<id> 项目上下文。
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";
import ResearchTool from "@/components/ResearchTool";
import { LoadingState, PageIntro } from "@/components/ui/signal-ui";
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
      <PageIntro
        eyebrow={projectName ? "项目内搜人" : "智能搜人"}
        title="把人才画像变成可审阅候选名单。"
        description={projectName ? `当前项目：${projectName}。先调整搜索条件，再手动启动深度研究。` : "描述 AI 人才画像，SignalHire 会拆解搜索策略、实时检索来源，并输出带证据的候选人列表。"}
        actions={<span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10"><FiSearch className="h-3.5 w-3.5" aria-hidden="true" /> 搜索工作台</span>}
      />
      <ResearchTool mode="search" initialInput={initialQ} autoRun={autoRun} projectId={projectId} projectName={projectName} />
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState title="正在打开搜索工作台" description="正在读取 URL 中的搜索条件和项目上下文。" />}>
      <SearchInner />
    </Suspense>
  );
}
