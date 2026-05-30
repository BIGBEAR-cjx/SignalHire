"use client";

// /app/verify —— 候选人核验台 (打脸)。
// ?demo=1 → 预填 HERO_BIO 并自动跑 (Landing 的"查看核验示例"按钮过来)
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import ResearchTool from "@/components/ResearchTool";
import { HERO_BIO } from "@/lib/cache";

function VerifyInner() {
  const sp = useSearchParams();
  const demo = sp.get("demo") === "1";
  const bio = sp.get("bio") || (demo ? HERO_BIO : "");
  const autoRun = Boolean(bio);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">候选人核验台</h1>
        <p className="mt-1 text-sm text-gray-500">粘贴候选人自述/简历/LinkedIn, 对每条声称做跨源核实。</p>
      </header>
      <ResearchTool mode="verify" initialInput={bio} autoRun={autoRun} />
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
