"use client";

// /app/projects —— 招聘项目列表 + 新建对话框
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FiFolder, FiPlus } from "react-icons/fi";
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

const STATUS_META: Record<Status, { label: string; chip: string; dot: string }> = {
  open:   { label: "进行中", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  paused: { label: "暂停",   chip: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  closed: { label: "已关闭", chip: "bg-gray-100 text-gray-600 ring-gray-200",         dot: "bg-gray-400" },
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectKpi[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/projects");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "加载失败");
      setProjects((j.projects ?? []) as ProjectKpi[]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

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
        eyebrow="招聘项目"
        title="把每个职位变成独立的人才研究空间。"
        description="管理岗位画像、候选人状态、历史研究和下一轮搜索，让 HR 与猎头围绕同一个上下文推进。"
        actions={(
          <PrimaryAction onClick={() => setDialogOpen(true)}>
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            新建项目
          </PrimaryAction>
        )}
      />

      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>}

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: "全部", count: counts.all },
          { value: "open", label: "进行中", count: counts.open },
          { value: "paused", label: "暂停", count: counts.paused },
          { value: "closed", label: "已关闭", count: counts.closed },
        ]}
      />

      {projects === null && !error && (
        <LoadingState title="正在加载招聘项目" description="正在读取项目、候选人数量和研究状态。" />
      )}

      {projects && projects.length === 0 && (
        <EmptyState
          title="还没有招聘项目"
          description="创建第一个项目，放入岗位画像；之后的搜人、收藏和核验都会自动归档到这个空间。"
          action={(
            <PrimaryAction onClick={() => setDialogOpen(true)}>
              <FiPlus className="h-4 w-4" aria-hidden="true" />
              新建第一个项目
            </PrimaryAction>
          )}
        />
      )}

      {projects && projects.length > 0 && filtered.length === 0 && (
        <EmptyState title="这个状态下没有项目" description="切换筛选条件，或创建一个新的招聘项目。" />
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
              {!p.brief && <p className="mt-2 text-sm italic text-[var(--sh-faint)]">暂无 brief</p>}
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-5 text-xs">
                <span className="rounded-full bg-neutral-100 px-2.5 py-1 font-semibold text-neutral-700 ring-1 ring-black/5">
                  {p.candidates_total} 位候选人
                </span>
                {p.candidates_active > 0 && p.candidates_active !== p.candidates_total && (
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 ring-1 ring-blue-100">
                    {p.candidates_active} 进行中
                  </span>
                )}
                {p.runs_active > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-800 ring-1 ring-amber-100">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    {p.runs_active} 研究进行
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
  const m = STATUS_META[status];
  return <StatusBadge label={m.label} dotClassName={m.dot} className={m.chip} />;
}

function NewProjectDialog({
  open, onClose, onCreated,
}: {
  open: boolean; onClose: () => void; onCreated: (project: { id: string }) => void;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState("");
  const [creating, setCreating] = useState(false);
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
    if (!name.trim()) { setError("项目名称必填"); return; }
    setCreating(true); setError("");
    try {
      const r = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), brief: brief.trim() || null }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "创建失败");
      reset();
      onCreated(j.project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={closeDialog}>
      <Surface
        className="sh-fade-in-up relative w-full max-w-lg p-6 shadow-[0_24px_80px_rgba(0,0,0,0.2)]"
      >
        <div onClick={(e) => e.stopPropagation()}>
        <IconButton label="关闭" onClick={closeDialog} className="absolute right-4 top-4" />
        <div className="pr-10">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">新建项目</p>
          <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">新建招聘项目</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">名称必填，brief 之后可改。建议直接粘贴 JD 或候选人画像。</p>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">项目名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:Senior LLM Infra Engineer"
              autoFocus
              maxLength={120}
              className="block w-full rounded-2xl border border-black/10 bg-white/72 px-4 py-3 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">招聘需求 / brief (可选)</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="粘贴 JD, 或一句话描述要找什么样的人。"
              className="block w-full resize-y rounded-2xl border border-black/10 bg-white/72 px-4 py-3 text-sm text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)] focus:border-black/20 focus:bg-white"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={closeDialog} className="sh-secondary-action min-h-10 px-4 py-2 text-sm">取消</button>
          <button onClick={submit} disabled={creating} className="sh-primary-action min-h-10 px-4 py-2 text-sm disabled:opacity-50">
            {creating ? "创建中…" : "创建"}
          </button>
        </div>
      </div>
      </Surface>
    </div>
  );
}
