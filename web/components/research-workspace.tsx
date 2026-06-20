import type { ChangeEvent, DragEvent, ReactNode } from "react";
import Link from "next/link";
import {
  FiActivity,
  FiArrowLeft,
  FiCheckCircle,
  FiEdit3,
  FiFileText,
  FiGlobe,
  FiPlay,
  FiRefreshCw,
  FiSearch,
  FiShare2,
  FiSquare,
  FiUploadCloud,
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

export type FeedbackChoiceGroup = {
  key: string;
  label: string;
  options: Array<{
    value: string;
    label: string;
    selected: boolean;
  }>;
};
type ResearchCoverageViewItem = {
  key: string;
  label: string;
  count: number;
};
type ResearchSourceGroupViewItem = ResearchCoverageViewItem & {
  latestKind: string;
  latestDetail: string;
};
type ResearchRecentViewItem = {
  id: number;
  kind: string;
  label: string;
  detail: string;
  sourceLabel?: string;
  intent?: string;
};
type ResearchStageViewItem = {
  key: string;
  state: string;
  label: string;
  detail: string;
};
type ResearchObservableCard = {
  label: string;
  detail: string;
};
type ResearchObservabilityView = {
  canStop: boolean;
  currentSearch: ResearchObservableCard;
  currentFetch: ResearchObservableCard;
  coverage: ResearchObservableCard;
};
type ResearchEvidenceTimelineItem = {
  id: number;
  stage: string;
  label: string;
  sourceLabel: string;
  detail: string;
  nextStep: string;
  state: string;
};
type ResearchEvidenceTimelineSummary = {
  label: string;
  detail: string;
};
type FeedbackOptimizationAction = {
  key: string;
  label: string;
  detail: string;
};
type FeedbackOptimizationPreviewModel = {
  canRun: boolean;
  statusText: string;
  actions: FeedbackOptimizationAction[];
};
export type ProjectFeedbackPreferenceView = {
  title: string;
  detail: string;
  optimizedInput: string;
  items: Array<{
    key: string;
    label: string;
    value: string;
  }>;
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

export function ProjectFeedbackPreferenceBanner({
  preference,
}: {
  preference: ProjectFeedbackPreferenceView;
}) {
  return (
    <div className="rounded-[22px] border border-black/10 bg-white/78 px-4 py-4 text-sm shadow-[0_14px_36px_rgba(0,0,0,0.04)] md:px-5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sh-ink)] text-white">
          <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-[var(--sh-ink)]">{preference.title}</p>
          <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{preference.detail}</p>
          {preference.items.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {preference.items.map((item) => (
                <span key={item.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-black/10 bg-[var(--sh-canvas)] px-3 py-1 text-xs text-[var(--sh-muted)]">
                  <span className="font-semibold text-[var(--sh-ink)]">{item.label}</span>
                  <span>{item.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ResearchInputStage({
  mode,
  input,
  onInputChange,
  onRun,
  onCreatePlan,
  onJdUpload,
  onResumeUpload,
  onSupportingMaterialUpload,
  activeUploadKind = "resume",
  loading,
  resumeUploading = false,
  resumeUploadMessage = "",
  resumeUploadWarning = "",
  resumeUploadError = "",
}: {
  mode: "search" | "verify";
  input: string;
  onInputChange: (value: string) => void;
  onRun: () => void;
  onCreatePlan?: () => void;
  onJdUpload?: (file: File) => void;
  onResumeUpload?: (file: File) => void;
  onSupportingMaterialUpload?: (file: File) => void;
  activeUploadKind?: "jd" | "resume" | "supportingMaterial";
  loading: boolean;
  resumeUploading?: boolean;
  resumeUploadMessage?: string;
  resumeUploadWarning?: string;
  resumeUploadError?: string;
}) {
  const { t } = useI18n();
  const isSearch = mode === "search";
  const uploadDisabled = loading || resumeUploading;
  function handleFileInput(event: ChangeEvent<HTMLInputElement>, kind: "jd" | "resume" | "supportingMaterial") {
    const file = event.target.files?.[0];
    event.target.value = "";
    const handler = kind === "jd" ? onJdUpload : kind === "supportingMaterial" ? onSupportingMaterialUpload : onResumeUpload;
    if (file && handler && !uploadDisabled) handler(file);
  }
  function handleDrop(event: DragEvent<HTMLDivElement>, kind: "jd" | "resume" | "supportingMaterial") {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    const handler = kind === "jd" ? onJdUpload : kind === "supportingMaterial" ? onSupportingMaterialUpload : onResumeUpload;
    if (file && handler && !uploadDisabled) handler(file);
  }
  const uploadItems = [
    {
      kind: "jd" as const,
      onUpload: onJdUpload,
      dropKey: "research.jdUploadDrop",
      supportedKey: "research.jdUploadSupported",
      buttonKey: "research.jdUploadButton",
      uploadingKey: "research.jdUploading",
      tone: "bg-blue-50 text-blue-700 ring-blue-100",
    },
    {
      kind: "resume" as const,
      onUpload: onResumeUpload,
      dropKey: "research.resumeUploadDrop",
      supportedKey: "research.resumeUploadSupported",
      buttonKey: "research.resumeUploadButton",
      uploadingKey: "research.resumeUploading",
      tone: "bg-amber-50 text-amber-700 ring-amber-100",
    },
    {
      kind: "supportingMaterial" as const,
      onUpload: onSupportingMaterialUpload,
      dropKey: "research.supportingMaterialUploadDrop",
      supportedKey: "research.supportingMaterialUploadSupported",
      buttonKey: "research.supportingMaterialUploadButton",
      uploadingKey: "research.supportingMaterialUploading",
      tone: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    },
  ];
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
        {((isSearch && onJdUpload) || (!isSearch && onResumeUpload)) && (
          <div className={`mt-5 grid gap-3 ${isSearch ? "" : "lg:grid-cols-2"}`}>
            {uploadItems.filter((item) => item.onUpload && (isSearch ? item.kind === "jd" : item.kind !== "jd")).map((item) => {
              const isActive = activeUploadKind === item.kind;
              const isUploadingThis = resumeUploading && isActive;
              return (
                <div
                  key={item.kind}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => handleDrop(event, item.kind)}
                  className="rounded-2xl border border-dashed border-black/15 bg-white/62 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ${item.tone}`}>
                        {isUploadingThis ? <FiZap className="h-5 w-5 animate-pulse" aria-hidden="true" /> : <FiUploadCloud className="h-5 w-5" aria-hidden="true" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--sh-ink)]">
                          {isUploadingThis ? t(item.uploadingKey) : t(item.dropKey)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{t(item.supportedKey)}</p>
                        {isActive && resumeUploadMessage && (
                          <p className="mt-2 inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">
                            <FiFileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="truncate">{resumeUploadMessage}</span>
                          </p>
                        )}
                        {isActive && resumeUploadWarning && <p className="mt-2 text-xs leading-5 text-amber-700">{resumeUploadWarning}</p>}
                        {isActive && resumeUploadError && <p className="mt-2 text-xs leading-5 text-red-600">{resumeUploadError}</p>}
                      </div>
                    </div>
                    <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1 transition ${
                      uploadDisabled
                        ? "pointer-events-none cursor-not-allowed bg-neutral-100 text-neutral-400 ring-black/5"
                        : "bg-white text-[var(--sh-ink)] ring-black/10 hover:bg-neutral-50"
                    }`}>
                      <FiUploadCloud className="h-4 w-4" aria-hidden="true" />
                      {t(item.buttonKey)}
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        onChange={(event) => handleFileInput(event, item.kind)}
                        className="sr-only"
                        disabled={uploadDisabled}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
          <PrimaryAction onClick={onRun} className="px-5" disabled={loading || resumeUploading || !input.trim()}>
            {loading ? <FiZap className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <FiPlay className="h-4 w-4" aria-hidden="true" />}
            {loading ? (isSearch ? t("research.searchLoading") : t("research.verifyLoading")) : (isSearch ? t("research.searchRun") : t("research.verifyRun"))}
          </PrimaryAction>
          {isSearch && onCreatePlan && (
            <SecondaryAction onClick={onCreatePlan} className="px-5" disabled={loading || !input.trim()}>
              <FiEdit3 className="h-4 w-4" aria-hidden="true" />
              {t("research.advancedPlanToggle")}
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

function coverageTone(key: string) {
  if (key === "github") return "bg-neutral-950 text-white ring-neutral-950";
  if (key === "papers") return "bg-blue-50 text-blue-700 ring-blue-100";
  if (key === "company") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  return "bg-white/80 text-[var(--sh-muted)] ring-black/10";
}

function recentIcon(kind: string) {
  return kind === "search" ? FiSearch : FiGlobe;
}

function stageTone(state: string) {
  if (state === "done") return "border-emerald-100 bg-emerald-50 text-emerald-800";
  if (state === "active") return "border-neutral-950 bg-neutral-950 text-white";
  return "border-black/10 bg-white/72 text-[var(--sh-muted)]";
}

export function ResearchProcessPanel({
  phaseLabel,
  phaseDetail,
  stageTimeline,
  statsText,
  sourceGroups,
  recentItems,
  observability,
  evidenceTimeline,
  evidenceTimelineSummary,
  statusDetail,
  onStop,
}: {
  phaseLabel: string;
  phaseDetail: string;
  stageTimeline: ResearchStageViewItem[];
  statsText: string;
  sourceGroups: ResearchSourceGroupViewItem[];
  recentItems: ResearchRecentViewItem[];
  observability: ResearchObservabilityView;
  evidenceTimeline: ResearchEvidenceTimelineItem[];
  evidenceTimelineSummary: ResearchEvidenceTimelineSummary;
  statusDetail?: string;
  onStop: () => void;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sh-ink)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            {t("research.processTitle")}
          </div>
          <p className="mt-1 text-sm leading-6 text-[var(--sh-muted)]">{phaseLabel}</p>
        </div>
        {observability.canStop && (
          <SecondaryAction onClick={onStop} className="min-h-9 px-3 py-2 text-xs">
            <FiSquare className="h-3.5 w-3.5" aria-hidden="true" />
            {t("research.stop")}
          </SecondaryAction>
        )}
      </div>

      {statusDetail && <p className="mt-3 text-xs leading-5 text-[var(--sh-muted)]">{statusDetail}</p>}

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <ObservableCard icon="search" item={observability.currentSearch} />
        <ObservableCard icon="fetch" item={observability.currentFetch} />
        <ObservableCard icon="coverage" item={observability.coverage} />
      </div>

      {stageTimeline.length > 0 && (
        <ol className="mt-5 grid gap-2 md:grid-cols-5">
          {stageTimeline.map((stage) => (
            <li
              key={stage.key}
              title={stage.detail}
              className={`rounded-2xl border px-3 py-3 transition ${stageTone(stage.state)}`}
            >
              <div className="flex items-center gap-2">
                {stage.state === "done" ? (
                  <FiCheckCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                ) : (
                  <FiActivity className={`h-3.5 w-3.5 shrink-0 ${stage.state === "active" ? "animate-pulse" : ""}`} aria-hidden="true" />
                )}
                <span className="min-w-0 truncate text-xs font-semibold">{stage.label}</span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {evidenceTimeline.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white/72 p-4 ring-1 ring-black/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-[var(--sh-muted)]">{evidenceTimelineSummary.label}</p>
              <p className="mt-1 text-sm leading-6 text-[var(--sh-ink)]">{evidenceTimelineSummary.detail}</p>
            </div>
          </div>
          <ol className="mt-4 grid gap-2 lg:grid-cols-2">
            {evidenceTimeline.slice(0, 6).map((item) => (
              <li key={`${item.id}-${item.stage}-${item.detail}`} className={`rounded-2xl border px-3 py-3 ${item.state === "active" ? "border-blue-100 bg-blue-50/70" : "border-black/5 bg-[var(--sh-canvas)]/70"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sh-ink)]">
                    {item.stage === "read" ? (
                      <FiGlobe className={`h-3.5 w-3.5 ${item.state === "active" ? "animate-pulse text-blue-600" : "text-[var(--sh-muted)]"}`} aria-hidden="true" />
                    ) : (
                      <FiSearch className={`h-3.5 w-3.5 ${item.state === "active" ? "animate-pulse text-blue-600" : "text-[var(--sh-muted)]"}`} aria-hidden="true" />
                    )}
                    {item.label}
                  </span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--sh-muted)] ring-1 ring-black/5">
                    {item.sourceLabel}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 break-all font-mono text-xs leading-5 text-[var(--sh-ink)]">{item.detail}</p>
                <p className="mt-2 text-xs leading-5 text-[var(--sh-muted)]">{item.nextStep}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-semibold text-emerald-700">{t("research.currentAction")}</p>
          <p className="mt-2 break-all font-mono text-sm leading-6 text-[var(--sh-ink)]">{phaseDetail || t("research.currentFallback")}</p>
        </div>
        <div className="rounded-2xl bg-white/72 p-4 ring-1 ring-black/5">
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("research.progress")}</p>
          <p className="mt-2 text-sm font-semibold text-[var(--sh-ink)]">{statsText}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div>
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("research.recentTitle")}</p>
          {recentItems.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-3 text-xs text-[var(--sh-faint)]">{t("research.timelineEmpty")}</p>
          ) : (
            <ol className="mt-3 max-h-80 space-y-3 overflow-auto pr-1">
              {recentItems.map((item) => {
                const Icon = recentIcon(item.kind);
                return (
                  <li key={`${item.id}-${item.kind}`} className="rounded-2xl bg-white/72 px-3 py-3 ring-1 ring-black/5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sh-muted)]">
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                        {item.label}
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        {item.sourceLabel && (
                          <span className="rounded-full bg-[var(--sh-canvas)] px-2 py-0.5 text-[11px] font-semibold text-[var(--sh-muted)] ring-1 ring-black/5">
                            {item.sourceLabel}
                          </span>
                        )}
                        <span className="text-[11px] text-[var(--sh-faint)]">#{item.id + 1}</span>
                      </span>
                    </div>
                    {item.intent && <p className="mt-2 text-xs leading-5 text-[var(--sh-muted)]">{item.intent}</p>}
                    <p className="mt-2 break-all font-mono text-xs leading-relaxed text-[var(--sh-ink)]">{item.detail}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold text-[var(--sh-muted)]">{t("research.coverageTitle")}</p>
          {sourceGroups.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-3 text-xs leading-5 text-[var(--sh-faint)]">{t("research.coverageEmpty")}</p>
          ) : (
            <div className="mt-3 space-y-2">
              {sourceGroups.map((item) => {
                const Icon = recentIcon(item.latestKind);
                return (
                  <div key={item.key} className="rounded-2xl bg-white/72 px-3 py-3 ring-1 ring-black/5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${coverageTone(item.key)}`}>
                        {item.label}
                        <span className="font-mono text-[11px] opacity-75">{item.count}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--sh-faint)]">
                        <Icon className="h-3 w-3" aria-hidden="true" />
                        {item.latestKind === "search" ? t("research.loop.event.search") : t("research.loop.event.fetch")}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 break-all font-mono text-[11px] leading-5 text-[var(--sh-muted)]">{item.latestDetail}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Surface>
  );
}

function ObservableCard({ icon, item }: { icon: "search" | "fetch" | "coverage"; item: ResearchObservableCard }) {
  const Icon = icon === "search" ? FiSearch : icon === "fetch" ? FiGlobe : FiActivity;
  const tone = icon === "search"
    ? "border-blue-100 bg-blue-50/70 text-blue-700"
    : icon === "fetch"
      ? "border-emerald-100 bg-emerald-50/70 text-emerald-700"
      : "border-neutral-200 bg-white/78 text-[var(--sh-muted)]";
  return (
    <div className={`rounded-3xl border p-4 ${tone}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="text-xs font-semibold">{item.label}</p>
      </div>
      <p className="mt-3 line-clamp-3 break-all font-mono text-sm leading-6 text-[var(--sh-ink)]">{item.detail}</p>
    </div>
  );
}

export function FeedbackOptimizationPreview({
  groups,
  preview,
  loading,
  onSelect,
  onRun,
}: {
  groups: FeedbackChoiceGroup[];
  preview: FeedbackOptimizationPreviewModel;
  loading: boolean;
  onSelect: (key: string, value: string) => void;
  onRun: () => void;
}) {
  const { t } = useI18n();
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("feedback.eyebrow")}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">{t("feedback.title")}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--sh-muted)]">{t("feedback.desc")}</p>
        </div>
        <PrimaryAction
          onClick={onRun}
          disabled={loading || !preview.canRun}
          className="px-4"
        >
          <FiRefreshCw className="h-4 w-4" aria-hidden="true" />
          {t("feedback.run")}
        </PrimaryAction>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {groups.map((group) => (
          <div key={group.key}>
            <p className="text-xs font-semibold text-[var(--sh-muted)]">{group.label}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {group.options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={option.selected}
                  onClick={() => onSelect(group.key, option.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    option.selected
                      ? "border-[var(--sh-ink)] bg-[var(--sh-ink)] text-white"
                      : "border-black/10 bg-white/72 text-[var(--sh-muted)] hover:border-black/20 hover:bg-white"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-black/10 bg-white/72 p-4">
        <div className="flex items-center gap-2">
          <FiActivity className="h-4 w-4 text-[var(--sh-muted)]" aria-hidden="true" />
          <p className="text-sm font-semibold text-[var(--sh-ink)]">{t("feedback.previewTitle")}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{preview.statusText}</p>
        {preview.actions.length > 0 && (
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {preview.actions.map((action: FeedbackOptimizationAction) => (
              <li key={action.key} className="rounded-2xl bg-white px-3 py-3 ring-1 ring-black/5">
                <p className="text-sm font-semibold text-[var(--sh-ink)]">{action.label}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--sh-muted)]">{action.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
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
