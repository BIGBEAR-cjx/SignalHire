"use client";

// /app/projects —— 招聘项目列表 + 新建对话框
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiDownloadCloud, FiFolder, FiPlus } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import {
  EmptyState,
  IconButton,
  IconTile,
  LoadingState,
  PageIntro,
  PrimaryAction,
  SegmentedControl,
  StatusBadge,
  Surface,
} from "@/components/ui/signal-ui";

type Status = "open" | "paused" | "closed";

interface ProjectKpi {
  id: string;
  name: string;
  brief: string | null;
  status: Status;
  color: string | null;
  created_at: string;
  updated_at: string;
  candidates_total: number;
  candidates_active: number;
  runs_total: number;
  runs_active: number;
}

const STATUS_META: Record<Status, { labelKey: string; chip: string; dot: string }> = {
  open:   { labelKey: "common.open", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  paused: { labelKey: "common.paused", chip: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  closed: { labelKey: "common.closed", chip: "bg-gray-100 text-gray-600 ring-gray-200",         dot: "bg-gray-400" },
};

export default function ProjectsPage() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectKpi[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects?locale=${locale}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t("projects.loadFailed"));
      setProjects((j.projects ?? []) as ProjectKpi[]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [locale, t]);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

  const filtered = useMemo(() => {
    if (!projects) return [];
    if (filter === "all") return projects;
    return projects.filter((p) => p.status === filter);
  }, [projects, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: projects?.length ?? 0, open: 0, paused: 0, closed: 0 };
    for (const p of projects ?? []) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [projects]);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow={t("projects.eyebrow")}
        title={t("projects.title")}
        description={t("projects.desc")}
        actions={(
          <PrimaryAction onClick={() => setDialogOpen(true)}>
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            {t("projects.new")}
          </PrimaryAction>
        )}
      />

      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{t("common.errorPrefix")}: {error}</p>}

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: t("common.all"), count: counts.all },
          { value: "open", label: t("common.open"), count: counts.open },
          { value: "paused", label: t("common.paused"), count: counts.paused },
          { value: "closed", label: t("common.closed"), count: counts.closed },
        ]}
      />

      {projects === null && !error && (
        <LoadingState title={t("projects.load")} description={t("projects.loadDesc")} />
      )}

      {projects && projects.length === 0 && (
        <EmptyState
          title={t("projects.emptyTitle")}
          description={t("projects.emptyDesc")}
          action={(
            <PrimaryAction onClick={() => setDialogOpen(true)}>
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              {t("projects.first")}
            </PrimaryAction>
          )}
        />
      )}

      {projects && projects.length > 0 && filtered.length === 0 && (
        <EmptyState title={t("projects.noFiltered")} description={t("projects.noFilteredDesc")} />
      )}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/app/projects/${p.id}`}
              className="group flex min-h-[220px] flex-col rounded-[28px] border border-black/10 bg-white/84 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_24px_68px_rgba(0,0,0,0.1)]"
            >
              <div className="flex items-start justify-between gap-3">
                <IconTile Icon={FiFolder} tone={p.status === "open" ? "blue" : p.status === "paused" ? "amber" : "neutral"} />
                <StatusChip status={p.status} />
              </div>
              <h2 className="mt-5 line-clamp-2 text-xl font-semibold tracking-tight text-[var(--sh-ink)]">{p.name}</h2>
              {p.brief && <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--sh-muted)]">{p.brief}</p>}
              {!p.brief && <p className="mt-2 text-sm italic text-[var(--sh-faint)]">{t("projects.noBrief")}</p>}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-xs">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700 ring-1 ring-black/5">
                  {p.candidates_total} {t("projects.people")}
                </span>
                {p.candidates_active > 0 && p.candidates_active !== p.candidates_total && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-100">
                    {p.candidates_active} {t("projects.activePeople")}
                  </span>
                )}
                {p.runs_active > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-amber-100">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    {p.runs_active} {t("projects.runsActive")}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      <NewProjectDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={(p) => {
          setDialogOpen(false);
          router.push(`/app/projects/${p.id}`);
        }}
      />
    </div>
  );
}

function StatusChip({ status }: { status: Status }) {
  const { t } = useI18n();
  const m = STATUS_META[status];
  return <StatusBadge label={t(m.labelKey)} dotClassName={m.dot} className={m.chip} />;
}

function NewProjectDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: (project: { id: string }) => void;
}) {
  const { locale, t } = useI18n();
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [creating, setCreating] = useState(false);
  const [importingAts, setImportingAts] = useState(false);
  const [atsJobId, setAtsJobId] = useState("greenhouse-demo-role");
  const [error, setError] = useState("");

  const reset = useCallback(() => {
    setName("");
    setBrief("");
    setError("");
  }, []);

  const closeDialog = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeDialog(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeDialog, open]);

  if (!open) return null;

  async function submit() {
    if (!name.trim()) { setError(t("projects.nameRequired")); return; }
    setCreating(true); setError("");
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), brief: brief.trim() || null, locale }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || t("common.create"));
      reset();
      onCreated(j.project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function importFromAts() {
    setImportingAts(true); setError("");
    try {
      const r = await fetch("/api/ats-lite/jobs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ external_job_id: atsJobId.trim() || "greenhouse-demo-role", locale }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "ats_import_failed");
      reset();
      onCreated(j.project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setImportingAts(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={closeDialog}>
      <Surface
        className="sh-fade-in-up relative w-full max-w-lg p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]"
      >
        <div onClick={(e) => e.stopPropagation()}>
        <IconButton label={t("common.cancel")} onClick={closeDialog} className="absolute right-4 top-4" />
        <div className="pr-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{t("projects.dialogEyebrow")}</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">{t("projects.dialogTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">{t("projects.dialogDesc")}</p>
        </div>

        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-xs font-medium text-gray-600">{locale === "en" ? "Greenhouse job ID" : "Greenhouse 岗位 ID"}</label>
                <input
                  value={atsJobId}
                  onChange={(e) => setAtsJobId(e.target.value)}
                  placeholder="greenhouse-demo-role"
                  className="block w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20"
                />
              </div>
              <button
                type="button"
                onClick={importFromAts}
                disabled={importingAts}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-neutral-950 px-3 py-2 text-xs font-semibold text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                <FiDownloadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                {importingAts ? (locale === "en" ? "Importing..." : "导入中...") : (locale === "en" ? "Import from ATS" : "从 ATS 导入")}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t("projects.name")}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("projects.namePlaceholder")}
              autoFocus
              maxLength={120}
              className="block w-full rounded-2xl border border-black/10 bg-white/72 px-4 py-3 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">{t("projects.brief")}</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder={t("projects.briefPlaceholder")}
              className="block w-full resize-y rounded-2xl border border-black/10 bg-white/72 px-4 py-3 text-sm text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)] focus:border-black/20 focus:bg-white"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={closeDialog} className="sh-secondary-action min-h-10 px-4 py-2 text-sm">{t("common.cancel")}</button>
          <button onClick={submit} disabled={creating} className="sh-primary-action min-h-10 px-4 py-2 text-sm disabled:opacity-50">
            {creating ? t("common.creating") : t("common.create")}
          </button>
        </div>
      </div>
      </Surface>
    </div>
  );
}
