"use client";

// /app/projects/[id] —— 招聘项目详情
// 头部 (name/brief 可编辑 + 状态 + 删除) + KPI + 候选人列表 (按 project 过滤) + 历史搜索
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CandidateProfileView } from "@/components/result";
import OutreachModal from "@/components/OutreachModal";
import type { TalentCandidate } from "@/lib/talent-profile.mjs";

type ProjectStatus = "open" | "paused" | "closed";
type ShortlistStatus = "new" | "contacted" | "interviewing" | "hired" | "rejected";

const PROJ_STATUS_META: Record<ProjectStatus, { label: string; chip: string; dot: string }> = {
  open:   { label: "进行中", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  paused: { label: "暂停",   chip: "bg-amber-50 text-amber-800 ring-amber-200",       dot: "bg-amber-500" },
  closed: { label: "已关闭", chip: "bg-gray-100 text-gray-600 ring-gray-200",         dot: "bg-gray-400" },
};

const SHORT_STATUS: { value: ShortlistStatus; label: string; chip: string; dot: string }[] = [
  { value: "new",          label: "待联系",   chip: "bg-gray-100 text-gray-700 ring-gray-200",        dot: "bg-gray-400" },
  { value: "contacted",    label: "已联系",   chip: "bg-blue-50 text-blue-700 ring-blue-200",         dot: "bg-blue-500" },
  { value: "interviewing", label: "面试中",   chip: "bg-amber-50 text-amber-800 ring-amber-200",      dot: "bg-amber-500" },
  { value: "hired",        label: "已 hire", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500" },
  { value: "rejected",     label: "已拒",     chip: "bg-rose-50 text-rose-700 ring-rose-200",         dot: "bg-rose-400" },
];

interface ProjectDetail {
  project: {
    id: string;
    name: string;
    brief: string | null;
    status: ProjectStatus;
    candidates_total: number;
    candidates_active: number;
    runs_total: number;
    runs_active: number;
  };
  breakdown: Record<ShortlistStatus, number>;
  runs: Array<{
    id: string;
    kind: "search" | "verify";
    label: string;
    summary: string | null;
    status: string;
    query_text: string;
    updated_at: string;
  }>;
}

interface ShortlistItem {
  id: string;
  source_run_id: string | null;
  project_id: string | null;
  candidate: unknown;
  status: ShortlistStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type CandidateLike = {
  name?: string;
  headline?: string;
  current_role?: string | null;
  current_company?: string | null;
  match_score?: number;
  ai_directions?: string[];
};
function asCandidate(x: unknown): CandidateLike { return (x ?? {}) as CandidateLike; }
function isTalentShape(x: unknown): x is TalentCandidate {
  const c = asCandidate(x);
  return typeof c.match_score === "number" && Array.isArray(c.ai_directions);
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [items, setItems] = useState<ShortlistItem[] | null>(null);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<ShortlistStatus | "all">("all");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const reloadDetail = useCallback(async () => {
    try {
      const r = await fetch(`/api/projects/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "加载失败");
      setDetail(j as ProjectDetail);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  const reloadItems = useCallback(async () => {
    try {
      const r = await fetch(`/api/shortlist?project=${encodeURIComponent(id)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "候选人加载失败");
      setItems((j.items ?? []) as ShortlistItem[]);
    } catch (e) { setError((e as Error).message); }
  }, [id]);

  useEffect(() => { if (id) { reloadDetail(); reloadItems(); } }, [id, reloadDetail, reloadItems]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (statusFilter === "all") return items;
    return items.filter((it) => it.status === statusFilter);
  }, [items, statusFilter]);

  const selectedItem = useMemo(() => filteredItems.find((it) => it.id === selectedItemId) ?? null, [filteredItems, selectedItemId]);

  async function deleteProject() {
    if (!confirm("删除这个项目?\n关联候选人和历史会回到「候选池(全部)」, 不会丢失。")) return;
    const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/app/projects");
    else alert("删除失败");
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <Link href="/app/projects" className="text-sm text-gray-500 hover:text-gray-900">← 回项目列表</Link>
        {error ? <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p> : <p className="text-sm text-gray-400">加载中…</p>}
      </div>
    );
  }

  const p = detail.project;
  const briefForSearch = (p.brief ?? "").trim() || p.name;

  return (
    <div className="space-y-6">
      <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">← 回项目列表</Link>

      {/* 头部: name + brief 编辑 + 状态 + 删除 */}
      <ProjectHeader detail={detail} onChanged={reloadDetail} onDelete={deleteProject} />

      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard label="候选人" value={p.candidates_total} sub="人" />
        {SHORT_STATUS.map((s) => (
          <KpiCard
            key={s.value}
            label={s.label}
            value={detail.breakdown[s.value] ?? 0}
            sub="人"
            accentDot={s.dot}
            onClick={() => setStatusFilter(s.value)}
          />
        ))}
      </section>

      {/* 动作 */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/app/search?project=${id}&q=${encodeURIComponent(briefForSearch)}`}
          className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800"
        >
          🔍 在本项目下搜人
        </Link>
        <Link
          href={`/app/verify?project=${id}`}
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-900"
        >
          ✅ 在本项目下核验
        </Link>
      </div>

      {/* 候选人列表 + 详情面板 */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold text-gray-700">候选人</h2>
          {items && items.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterPill value="all" current={statusFilter} onClick={setStatusFilter} label={`全部 ${items.length}`} />
              {SHORT_STATUS.map((s) => {
                const n = detail.breakdown[s.value] ?? 0;
                if (n === 0 && statusFilter !== s.value) return null;
                return <FilterPill key={s.value} value={s.value} current={statusFilter} onClick={setStatusFilter} label={`${s.label} ${n}`} />;
              })}
            </div>
          )}
        </div>

        {items === null && <p className="text-sm text-gray-400">加载中…</p>}
        {items && items.length === 0 && (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
            <p className="text-sm text-gray-500">本项目还没有候选人。「在本项目下搜人」开始第一次研究。</p>
          </div>
        )}
        {items && items.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
            <ul className="space-y-2">
              {filteredItems.map((it) => (
                <CandidateItem key={it.id} item={it} selected={selectedItemId === it.id} onClick={() => setSelectedItemId(it.id)} />
              ))}
              {filteredItems.length === 0 && (
                <li className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-center text-sm text-gray-500">这个状态下没有候选人。</li>
              )}
            </ul>
            <div className="lg:sticky lg:top-6 lg:self-start">
              {selectedItem ? (
                <CandidateDetailPanel
                  item={selectedItem}
                  projectId={id}
                  onChanged={(patch) => {
                    setItems((prev) => prev?.map((it) => it.id === selectedItem.id ? { ...it, ...patch } : it) ?? prev);
                    reloadDetail();
                  }}
                  onDeleted={() => {
                    setItems((prev) => prev?.filter((it) => it.id !== selectedItem.id) ?? prev);
                    setSelectedItemId(null);
                    reloadDetail();
                  }}
                  onUnassigned={() => {
                    setItems((prev) => prev?.filter((it) => it.id !== selectedItem.id) ?? prev);
                    setSelectedItemId(null);
                    reloadDetail();
                  }}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500">
                  点左侧候选人查看画像、切状态、写备注。
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 历史搜索 */}
      {detail.runs.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">本项目历史研究 ({detail.runs.length})</h2>
          <ul className="space-y-2">
            {detail.runs.map((r) => {
              const target = r.kind === "search"
                ? `/app/search?project=${id}&q=${encodeURIComponent(r.query_text)}`
                : `/app/verify?project=${id}&bio=${encodeURIComponent(r.query_text)}`;
              return (
                <li key={r.id}>
                  <Link href={target} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-blue-400">
                    <span className="flex min-w-0 items-center gap-2">
                      <KindBadge kind={r.kind} />
                      <span className="min-w-0 truncate text-sm text-gray-800" title={r.query_text}>{r.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{r.summary ?? r.status}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function KindBadge({ kind }: { kind: "search" | "verify" }) {
  if (kind === "search") return <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">搜人</span>;
  return <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">核验</span>;
}

function KpiCard({ label, value, sub, accentDot, onClick }: { label: string; value: number; sub: string; accentDot?: string; onClick?: () => void }) {
  const inner = (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-1.5">
        {accentDot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${accentDot}`} />}
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </div>
  );
  if (onClick) return <button onClick={onClick} className="text-left">{inner}</button>;
  return inner;
}

function FilterPill({ value, current, onClick, label }: { value: ShortlistStatus | "all"; current: ShortlistStatus | "all"; onClick: (v: ShortlistStatus | "all") => void; label: string }) {
  const active = current === value;
  return (
    <button
      onClick={() => onClick(value)}
      className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
        active ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
      }`}
    >
      {label}
    </button>
  );
}

function ProjectHeader({ detail, onChanged, onDelete }: { detail: ProjectDetail; onChanged: () => void; onDelete: () => void }) {
  const p = detail.project;
  const [editingName, setEditingName] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [name, setName] = useState(p.name);
  const [brief, setBrief] = useState(p.brief ?? "");

  useEffect(() => { setName(p.name); setBrief(p.brief ?? ""); }, [p.name, p.brief]);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (r.ok) onChanged();
  }

  async function saveName() {
    setEditingName(false);
    if (name.trim() && name !== p.name) await patch({ name: name.trim() });
    else setName(p.name);
  }
  async function saveBrief() {
    setEditingBrief(false);
    if (brief !== (p.brief ?? "")) await patch({ brief: brief.trim() || null });
  }

  const meta = PROJ_STATUS_META[p.status];

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(p.name); setEditingName(false); }}}
              autoFocus
              maxLength={120}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-2xl font-bold text-gray-900 outline-none focus:border-gray-900"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="cursor-text rounded-md text-2xl font-bold tracking-tight text-gray-900 hover:bg-gray-50"
              title="点击编辑"
            >
              {p.name}
            </h1>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={p.status}
            onChange={(e) => patch({ status: e.target.value })}
            className={`appearance-none rounded-full px-3 py-1 text-xs font-medium ring-1 outline-none ${meta.chip}`}
          >
            <option value="open">进行中</option>
            <option value="paused">暂停</option>
            <option value="closed">已关闭</option>
          </select>
          <button onClick={onDelete} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">删除</button>
        </div>
      </div>

      {/* brief */}
      <div className="rounded-xl border border-gray-100 bg-white p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">招聘需求 / brief</span>
          {!editingBrief && <button onClick={() => setEditingBrief(true)} className="text-xs text-gray-500 hover:text-gray-900">{p.brief ? "编辑" : "+ 添加"}</button>}
        </div>
        {editingBrief ? (
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={saveBrief}
            autoFocus
            rows={4}
            placeholder="粘贴 JD, 或一句话描述要找什么样的人。"
            className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:bg-white"
          />
        ) : (
          <p className={`whitespace-pre-line text-sm ${p.brief ? "text-gray-700" : "text-gray-400 italic"}`}>
            {p.brief || "暂无 brief — 加上之后, 在本项目下搜人会自动用它"}
          </p>
        )}
      </div>
    </header>
  );
}

function CandidateItem({ item, selected, onClick }: { item: ShortlistItem; selected: boolean; onClick: () => void }) {
  const c = asCandidate(item.candidate);
  const subtitle = [c.current_role, c.current_company].filter(Boolean).join(" · ") || c.headline || "";
  const status = SHORT_STATUS.find((s) => s.value === item.status) ?? SHORT_STATUS[0];
  return (
    <li>
      <button
        onClick={onClick}
        className={`flex w-full flex-col gap-2 rounded-xl border bg-white p-4 text-left transition ${
          selected ? "border-gray-900 shadow-[0_8px_30px_rgba(0,0,0,0.06)]" : "border-gray-200 hover:border-gray-400"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-900">{c.name || "(无名)"}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {typeof c.match_score === "number" && (
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-gray-700">{c.match_score}</span>
            )}
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${status.chip}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>
        </div>
        {item.notes && <p className="line-clamp-2 text-xs text-gray-600">📝 {item.notes}</p>}
      </button>
    </li>
  );
}

function CandidateDetailPanel({
  item, projectId, onChanged, onDeleted, onUnassigned,
}: {
  item: ShortlistItem;
  projectId: string;
  onChanged: (patch: Partial<ShortlistItem>) => void;
  onDeleted: () => void;
  onUnassigned: () => void;
}) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savedHint, setSavedHint] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setNotes(item.notes ?? ""); }, [item.id, item.notes]);

  async function patch(body: Record<string, unknown>) {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "更新失败");
  }

  async function setStatus(next: ShortlistStatus) {
    if (next === item.status || savingStatus) return;
    setSavingStatus(true);
    const prev = item.status;
    onChanged({ status: next });
    try { await patch({ status: next }); } catch { onChanged({ status: prev }); } finally { setSavingStatus(false); }
  }

  const saveNotes = useCallback(async (v: string) => {
    try { await patch({ notes: v }); onChanged({ notes: v }); setSavedHint(true); setTimeout(() => setSavedHint(false), 1500); } catch {}
  }, [item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function onNotesChange(v: string) {
    setNotes(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveNotes(v), 800);
  }

  async function handleDelete() {
    if (!confirm("把这个候选人移出候选池?")) return;
    const r = await fetch(`/api/shortlist/${item.id}`, { method: "DELETE" });
    if (r.ok) onDeleted();
  }

  async function unassignFromProject() {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: null }),
    });
    if (r.ok) onUnassigned();
  }

  const candidate = item.candidate;
  const isTalent = isTalentShape(candidate);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      {/* 状态切换 + 工具栏 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {SHORT_STATUS.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            disabled={savingStatus}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
              item.status === s.value ? "bg-gray-900 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={unassignFromProject} className="rounded-md px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">移出项目</button>
        <button onClick={handleDelete} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">删除</button>
      </div>

      <button
        onClick={() => setOutreachOpen(true)}
        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-600 hover:to-emerald-700"
      >
        ✉️ AI 起草外联邮件
      </button>
      <OutreachModal
        open={outreachOpen}
        onClose={() => setOutreachOpen(false)}
        candidate={candidate}
        candidateName={asCandidate(candidate).name}
      />

      {/* 备注 */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium text-gray-600">备注</label>
          <span className="text-[11px] text-gray-400">{savedHint ? "✓ 已保存" : "自动保存"}</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder="第一次约见印象 / 你想问的问题 / 候选人对项目的反应…"
          className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:bg-white"
        />
      </div>

      <div className="text-xs text-gray-500">添加于 {new Date(item.created_at).toLocaleString("zh-CN")}</div>

      <div className="border-t border-gray-100 pt-4">
        {isTalent ? (
          <CandidateProfileView candidate={candidate as TalentCandidate} />
        ) : (
          <LegacyCandidateView candidate={candidate} />
        )}
      </div>
    </div>
  );
}

function LegacyCandidateView({ candidate }: { candidate: unknown }) {
  const c = asCandidate(candidate);
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-gray-900">{c.name || "(无名)"}</h2>
      {c.headline && <p className="text-gray-600">{c.headline}</p>}
    </div>
  );
}
