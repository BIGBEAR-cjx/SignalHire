import type { ReactNode } from "react";
import Link from "next/link";
import {
  FiArrowLeft,
  FiCheckCircle,
  FiEdit3,
  FiPlay,
  FiSearch,
  FiShare2,
  FiSquare,
  FiZap,
} from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { PrimaryAction, SecondaryAction, Surface } from "@/components/ui/signal-ui";

export type ResearchTimelineItem = {
  id: number;
  kind: "search" | "fetch";
  label: string;
  detail: string;
};

export function ProjectContextBanner({
  projectId,
  projectName,
  mode,
}: {
  projectId: string;
  projectName?: string;
  mode: "search" | "verify";
}) {
  const { t } = useI18n();
  const action = mode === "search" ? t("research.projectSearch") : t("research.projectVerify");
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-900">
      <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
      <span>{t("research.projectPrefix", { name: projectName ?? t("research.projectFallback"), action })}</span>
      <span className="text-emerald-700/80">{t("research.projectArchive")}</span>
      <span className="flex-1" />
      <Link href={`/app/projects/${projectId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950">
        <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t("research.backProject")}
      </Link>
    </div>
  );
}

export function ResearchInputStage({
  mode,
  input,
  onInputChange,
  onRun,
  onCreatePlan,
  loading,
}: {
  mode: "search" | "verify";
  input: string;
  onInputChange: (value: string) => void;
  onRun: () => void;
  onCreatePlan?: () => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  const isSearch = mode === "search";
  return (
    <Surface className="overflow-hidden p-0">
      <div className="px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{isSearch ? t("research.searchBrief") : t("research.verifyBrief")}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">{isSearch ? t("research.searchInputTitle") : t("research.verifyInputTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">
              {isSearch
                ? t("research.searchInputDesc")
                : t("research.verifyInputDesc")}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isSearch ? "bg-blue-50 text-blue-700 ring-blue-100" : "bg-amber-50 text-amber-800 ring-amber-100"}`}>
            {isSearch ? t("research.searchBadge") : t("research.verifyBadge")}
          </span>
        </div>
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          rows={isSearch ? 6 : 8}
          placeholder={
            isSearch
              ? t("research.searchPlaceholder")
              : t("research.verifyPlaceholder")
          }
          className="mt-5 block max-h-[46vh] min-h-[180px] w-full resize-y rounded-[22px] border border-black/10 bg-white/72 px-4 py-4 text-[15px] leading-7 text-[var(--sh-ink)] outline-none transition placeholder:text-[var(--sh-faint)] focus:border-black/20 focus:bg-white"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrimaryAction onClick={onRun} className="px-5" disabled={loading || !input.trim()}>
            {loading ? <FiZap className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <FiPlay className="h-4 w-4" aria-hidden="true" />}
            {loading ? (isSearch ? t("research.searchLoading") : t("research.verifyLoading")) : (isSearch ? t("research.searchRun") : t("research.verifyRun"))}
          </PrimaryAction>
          {isSearch && onCreatePlan && (
            <SecondaryAction onClick={onCreatePlan} className="px-5" disabled={loading || !input.trim()}>
              <FiEdit3 className="h-4 w-4" aria-hidden="true" />
              {t("research.createPlan")}
            </SecondaryAction>
          )}
          <span className="text-xs text-[var(--sh-faint)]">{t("research.charCount", { count: input.length })}</span>
        </div>
      </div>
    </Surface>
  );
}

export function EditableSearchPlanPanel({
  children,
  onRunPlan,
  loading,
}: {
  children: ReactNode;
  onRunPlan: () => void;
  loading: boolean;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("research.planEyebrow")}</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("research.planTitle")}</h3>
        </div>
        <PrimaryAction onClick={onRunPlan} disabled={loading}>
          <FiPlay className="h-4 w-4" aria-hidden="true" />
          {t("research.runPlan")}
        </PrimaryAction>
      </div>
      <div className="mt-5">{children}</div>
    </Surface>
  );
}

export function ResearchTimelinePanel({
  label,
  detail,
  statsText,
  timeline,
  statusDetail,
  onStop,
}: {
  label?: string;
  detail?: string;
  statsText: string;
  timeline: ResearchTimelineItem[];
  statusDetail?: string;
  onStop: () => void;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sh-ink)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {t("research.timelineTitle")}
          </div>
          <p className="mt-1 text-sm text-[var(--sh-muted)]">{label ?? t("research.timelineFallback")}</p>
        </div>
        <SecondaryAction onClick={onStop} className="min-h-9 px-3 py-2 text-xs">
          <FiSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {t("research.stop")}
        </SecondaryAction>
      </div>
      {statusDetail && <p className="mt-3 text-xs leading-5 text-[var(--sh-muted)]">{statusDetail}</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-semibold text-emerald-700">{t("research.currentAction")}</p>
          <p className="mt-2 break-all font-mono text-sm leading-6 text-[var(--sh-ink)]">{detail ?? t("research.currentFallback")}</p>
        </div>
        <div className="rounded-3xl bg-white/72 p-4 ring-1 ring-black/5">
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("research.progress")}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--sh-ink)]">{statsText}</p>
        </div>
      </div>
      {timeline.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--sh-faint)]">{t("research.timelineEmpty")}</p>
      ) : (
        <ol className="mt-5 max-h-80 space-y-3 overflow-auto pr-1">
          {timeline.map((item) => (
            <li key={`${item.id}-${item.kind}`} className="rounded-2xl bg-white/72 px-3 py-3 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sh-muted)]">
                  {item.kind === "search" ? <FiSearch className="h-3.5 w-3.5" aria-hidden="true" /> : <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  {item.label}
                </span>
                <span className="text-[11px] text-[var(--sh-faint)]">#{item.id + 1}</span>
              </div>
              <p className="mt-2 break-all font-mono text-xs leading-relaxed text-[var(--sh-ink)]">{item.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}

export function ResearchErrorPanel({
  error,
  canRetry,
  onRetry,
}: {
  error: string;
  canRetry?: boolean;
  onRetry?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-red-100 bg-red-50/90 p-4 text-sm text-red-700">
      <p>{t("common.errorPrefix")}: {error}</p>
      {canRetry && onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">
          {t("research.retry")}
        </button>
      )}
    </div>
  );
}

export function ResearchShareBar({
  statsText,
  cached,
  copied,
  onCopy,
}: {
  statsText?: string;
  cached?: boolean;
  copied: boolean;
  onCopy?: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--sh-muted)]">
        {cached ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">{t("research.cached")}</span> : statsText}
      </p>
      {onCopy && (
        <button onClick={onCopy} className="sh-secondary-action min-h-9 px-3 py-2 text-xs">
          <FiShare2 className="h-3.5 w-3.5" aria-hidden="true" />
          {copied ? t("research.copyDone") : t("research.share")}
        </button>
      )}
    </div>
  );
}

export function ResearchResultShell({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}
