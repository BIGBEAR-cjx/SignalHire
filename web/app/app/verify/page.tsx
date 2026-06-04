"use client";

// /app/verify —— 候选人核验台 (打脸)。
// ?demo=1 → 预填 HERO_BIO; ?bio=... 直接预填; ?project=<id> 项目上下文
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import ResearchTool from "@/components/ResearchTool";
import { PageIntro } from "@/components/ui/signal-ui";
import { HERO_BIO } from "@/lib/cache";

function VerifyInner() {
  const sp = useSearchParams();
  const demo = sp.get("demo") === "1";
  const bio = sp.get("bio") || (demo ? HERO_BIO : "");
  const projectId = sp.get("project") || undefined;
  const autoRun = Boolean(bio);
  const [projectName, setProjectName] = useState<string | undefined>();

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}`).then((r) => r.ok ? r.json() : null).then((j) => {
      if (j?.project?.name) setProjectName(j.project.name);
    }).catch(() => {});
  }, [projectId]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={projectName ? "项目内核验" : "候选人核验台"}
        title="把候选人自述拆成可核验证据。"
        description={projectName ? `当前项目：${projectName}。核验结果会回到项目上下文。` : "粘贴候选人材料，系统会按声明逐条查证，输出可信度、红旗和可点击来源。"}
        actions={<span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10"><FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> 证据核验</span>}
      />
      <ResearchTool mode="verify" initialInput={bio} autoRun={autoRun} projectId={projectId} projectName={projectName} />
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-400">加载中…</div>}>
      <VerifyInner />
    </Suspense>
  );
}
