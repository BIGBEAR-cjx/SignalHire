"use client";

// /app/verify —— 候选人核验台 (打脸)。
// ?demo=1 → 预填 HERO_BIO; ?bio=... 直接预填; ?project=<id> 项目上下文
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FiCheckCircle } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import ResearchTool from "@/components/ResearchTool";
import { LoadingState, PageIntro } from "@/components/ui/signal-ui";
import { HERO_BIO } from "@/lib/cache";

function VerifyInner() {
  const { t } = useI18n();
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
        eyebrow={projectName ? t("verify.projectEyebrow") : t("verify.eyebrow")}
        title={t("verify.title")}
        description={projectName ? t("verify.projectDesc", { name: projectName }) : t("verify.desc")}
        actions={<span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10"><FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> {t("verify.badge")}</span>}
      />
      <ResearchTool mode="verify" initialInput={bio} autoRun={autoRun} projectId={projectId} projectName={projectName} />
    </div>
  );
}

export default function VerifyPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<LoadingState title={t("verify.loading")} description={t("verify.loadingDesc")} />}>
      <VerifyInner />
    </Suspense>
  );
}
