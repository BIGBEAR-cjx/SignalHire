"use client";

// /app/search —— 智能搜人。
// 支持 ?q=<query> 预填 + 自动跑; ?project=<id> 项目上下文。
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import ResearchTool from "@/components/ResearchTool";
import type { ProjectFeedbackPreferenceView } from "@/components/research-workspace";
import { LoadingState, PageIntro } from "@/components/ui/signal-ui";
import { buildLatestProjectFeedbackPreference } from "@/lib/research-loop.mjs";
import { shouldAutoRunInitialSearch } from "@/lib/search-page-state.mjs";

function SearchInner() {
  const { locale, t } = useI18n();
  const sp = useSearchParams();
  const initialQ = sp.get("q") || "";
  const projectId = sp.get("project") || undefined;
  const autoRun = shouldAutoRunInitialSearch({ initialInput: initialQ, projectId });
  const [projectName, setProjectName] = useState<string | undefined>();
  const [projectFeedbackPreference, setProjectFeedbackPreference] = useState<ProjectFeedbackPreferenceView | null>(null);

  // 在项目上下文时拉项目名 (面包屑显示)
  useEffect(() => {
    if (!projectId) {
      setProjectName(undefined);
      setProjectFeedbackPreference(null);
      return;
    }
    fetch(`/api/projects/${projectId}`).then((r) => r.ok ? r.json() : null).then((j) => {
      if (j?.project?.name) setProjectName(j.project.name);
      const preference = buildLatestProjectFeedbackPreference({
        runs: Array.isArray(j?.runs) ? j.runs : [],
        baseInput: initialQ,
        locale,
      });
      setProjectFeedbackPreference(preference.canApply ? preference : null);
    }).catch(() => {});
  }, [initialQ, locale, projectId]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={projectName ? t("search.projectEyebrow") : t("search.eyebrow")}
        title={t("search.title")}
        description={projectName ? t("search.projectDesc", { name: projectName }) : t("search.desc")}
        actions={<span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10"><FiSearch className="h-3.5 w-3.5" aria-hidden="true" /> {t("search.badge")}</span>}
      />
      <ResearchTool
        mode="search"
        initialInput={initialQ}
        autoRun={autoRun}
        projectId={projectId}
        projectName={projectName}
        projectFeedbackPreference={projectFeedbackPreference}
      />
    </div>
  );
}

export default function SearchPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<LoadingState title={t("search.loading")} description={t("search.loadingDesc")} />}>
      <SearchInner />
    </Suspense>
  );
}
