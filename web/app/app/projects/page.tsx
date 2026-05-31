"use client";

// /app/projects —— 招聘项目列表 + 新建对话框
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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

  useEffect(() => { reload(); }, []);

  async function reload() {
    try {
      const r = await fetch("/api/projects");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "加载失败");
      setProjects((j.projects ?? []) as ProjectKpi[]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

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
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">招聘项目</h1>
          <p className="mt-1 text-sm text-gray-500">每个职位一个项目, 内置 brief、候选池、状态流、历史搜索。</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
        >
          + 新建项目
        </button>
      </header>

      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>}

      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterTab value="all" current={filter} onClick={setFilter} label="全部" count={counts.all} />
        <FilterTab value="open" current={filter} onClick={setFilter} label="进行中" count={counts.open} />
        <FilterTab value="paused" current={filter} onClick={setFilter} label="暂停" count={counts.paused} />
        <FilterTab value="closed" current={filter} onClick={setFilter} label="已关闭" count={counts.closed} />
      </div>

      {projects === null && !error && <p className="text-sm text-gray-400">加载中…</p>}

      {/* 空状态 */}
      {projects && projects.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-xl ring-1 ring-blue-100">📁</div>
          <p className="text-sm text-gray-500">还没有项目。建第一个,放进 JD,接下来的搜人/收藏都按这个项目归档。</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            + 新建第一个项目
          </button>
        </div>
      )}

      {/* 项目卡片网格 */}
      {projects && projects.length > 0 && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          这个状态下没有项目。
        </div>
      )}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/app/projects/${p.id}`}
              className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="line-clamp-2 text-base font-semibold text-gray-900 group-hover:underline">{p.name}</h2>
                <StatusChip status={p.status} />
              </div>
              {p.brief && <p className="mt-2 line-clamp-2 text-xs text-gray-500">{p.brief}</p>}
              {!p.brief && <p className="mt-2 text-xs text-gray-400 italic">无 brief</p>}
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-md bg-gray-50 px-2 py-0.5 font-medium text-gray-700 ring-1 ring-gray-100">
                  {p.candidates_total} 候选人
                </span>
                {p.candidates_active > 0 && p.candidates_active !== p.candidates_total && (
                  <span className="rounded-md bg-blue-50 px-2 py-0.5 font-medium text-blue-700 ring-1 ring-blue-100">
                    {p.candidates_active} 进行中
                  </span>
                )}
                {p.runs_active > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-100">
                    <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                    {p.runs_active} 研究进行
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 新建对话框 */}
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

function FilterTab({
  value, current, onClick, label, count,
}: {
  value: Status | "all"; current: Status | "all"; onClick: (v: Status | "all") => void; label: string; count: number;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
      }`}
    >
      <span>{label}</span>
      <span className={active ? "text-gray-300" : "text-gray-400"}>{count}</span>
    </button>
  );
}

function StatusChip({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${m.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
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

  useEffect(() => {
    if (!open) { setName(""); setBrief(""); setError(""); }
  }, [open]);

  // Esc 关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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
      onCreated(j.project);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="sh-fade-in-up relative w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} aria-label="关闭" className="absolute right-4 top-4 text-gray-400 hover:text-gray-900">✕</button>
        <h2 className="text-lg font-bold text-gray-900">新建招聘项目</h2>
        <p className="mt-1 text-xs text-gray-500">名称必填, brief 之后可改。</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">项目名称</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如:Senior LLM Infra Engineer"
              autoFocus
              maxLength={120}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:bg-white"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">招聘需求 / brief (可选)</label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="粘贴 JD, 或一句话描述要找什么样的人。"
              className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:border-gray-900">取消</button>
          <button onClick={submit} disabled={creating} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50">
            {creating ? "创建中…" : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}
