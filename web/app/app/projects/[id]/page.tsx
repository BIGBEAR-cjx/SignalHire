"use client";

// /app/projects/[id] —— 招聘项目详情
// 头部 (name/brief 可编辑 + 状态 + 删除) + KPI + 候选人列表 (按 project 过滤) + 历史搜索
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FiArrowLeft, FiCheckCircle, FiMail, FiSearch, FiTrash2 } from "react-icons/fi";
import { CandidateComparisonView, CandidateProfileView } from "@/components/result";
import OutreachModal from "@/components/OutreachModal";
import {
  EmptyState,
  IconButton,
  PrimaryAction,
  SecondaryAction,
  SegmentedControl,
  StatusBadge,
  Surface,
} from "@/components/ui/signal-ui";
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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const [detailRes, itemsRes] = await Promise.all([
          fetch(`/api/projects/${id}`),
          fetch(`/api/shortlist?project=${encodeURIComponent(id)}`),
        ]);
        const [detailJson, itemsJson] = await Promise.all([detailRes.json(), itemsRes.json()]);
        if (cancelled) return;
        if (!detailRes.ok) throw new Error(detailJson.error || "加载失败");
        if (!itemsRes.ok) throw new Error(itemsJson.error || "候选人加载失败");
        setDetail(detailJson as ProjectDetail);
        setItems((itemsJson.items ?? []) as ShortlistItem[]);
        setError("");
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  const filteredItems = useMemo(() => {
    if (!items) return [];
    if (statusFilter === "all") return items;
    return items.filter((it) => it.status === statusFilter);
  }, [items, statusFilter]);

  const selectedItem = useMemo(() => filteredItems.find((it) => it.id === selectedItemId) ?? null, [filteredItems, selectedItemId]);
  const projectComparisonResult = useMemo(() => ({
    candidates: (items ?? []).map((it) => it.candidate),
  }), [items]);

  async function deleteProject() {
    if (!confirm("删除这个项目?\n关联候选人和历史会回到「候选池(全部)」, 不会丢失。")) return;
    const r = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (r.ok) router.push("/app/projects");
    else alert("删除失败");
  }

  if (!detail) {
    return (
      <div className="space-y-4">
        <SecondaryAction href="/app/projects" className="min-h-9 px-3 py-2 text-xs">
          <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          回项目列表
        </SecondaryAction>
        {error ? <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</p> : <p className="text-sm text-gray-400">加载中…</p>}
      </div>
    );
  }

  const p = detail.project;
  const briefForSearch = (p.brief ?? "").trim() || p.name;

  return (
    <div className="space-y-6">
      <SecondaryAction href="/app/projects" className="min-h-9 px-3 py-2 text-xs">
        <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        回项目列表
      </SecondaryAction>

      {/* 头部: name + brief 编辑 + 状态 + 删除 */}
      <ProjectHeader key={`${p.id}:${p.name}:${p.brief ?? ""}`} detail={detail} onChanged={reloadDetail} onDelete={deleteProject} />

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

      <StatusFunnel breakdown={detail.breakdown} total={p.candidates_total} current={statusFilter} onClick={setStatusFilter} />

      {/* 动作 */}
      <div className="flex flex-wrap gap-2">
        <PrimaryAction
          href={`/app/search?project=${id}&q=${encodeURIComponent(briefForSearch)}`}
        >
          <FiSearch className="h-4 w-4" aria-hidden="true" />
          在本项目下搜人
        </PrimaryAction>
        <SecondaryAction
          href={`/app/verify?project=${id}`}
        >
          <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
          在本项目下核验
        </SecondaryAction>
      </div>

      {/* 候选人列表 + 详情面板 */}
      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="text-sm font-semibold text-gray-700">候选人</h2>
          {items && items.length > 0 && (
            <SegmentedControl
              value={statusFilter}
              onChange={setStatusFilter}
              items={[
                { value: "all", label: "全部", count: items.length },
                ...SHORT_STATUS
                  .filter((s) => (detail.breakdown[s.value] ?? 0) > 0 || statusFilter === s.value)
                  .map((s) => ({ value: s.value, label: s.label, count: detail.breakdown[s.value] ?? 0 })),
              ]}
            />
          )}
        </div>

        {items === null && <p className="text-sm text-gray-400">加载中…</p>}
        {items && items.length === 0 && (
          <EmptyState title="本项目还没有候选人" description="先在本项目下启动一次搜人，候选人会自动回到这个项目空间。" />
        )}
        {items && items.length > 0 && (
          <div className="space-y-4">
            <CandidateComparisonView result={projectComparisonResult} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
              <ul className="space-y-2">
                {filteredItems.map((it) => (
                  <CandidateItem key={it.id} item={it} selected={selectedItemId === it.id} onClick={() => setSelectedItemId(it.id)} />
                ))}
                {filteredItems.length === 0 && (
                  <li><EmptyState title="这个状态下没有候选人" description="切换状态筛选，或继续补充候选人。" /></li>
                )}
              </ul>
              <div className="lg:sticky lg:top-6 lg:self-start">
                {selectedItem ? (
                  <CandidateDetailPanel
                    key={selectedItem.id}
                    item={selectedItem}
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
                  <div className="rounded-3xl border border-dashed border-black/10 bg-white/80 p-5 text-sm text-[var(--sh-muted)]">
                    点左侧候选人查看画像、切状态、写备注。
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 历史搜索 */}
      {detail.runs.length > 0 && (
        <section className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Research history</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">本项目历史研究 ({detail.runs.length})</h2>
          </div>
          <ul className="space-y-2">
            {detail.runs.map((r) => {
              const target = r.kind === "search"
                ? `/app/search?project=${id}&q=${encodeURIComponent(r.query_text)}`
                : `/app/verify?project=${id}&bio=${encodeURIComponent(r.query_text)}`;
              return (
                <li key={r.id}>
                  <Link href={target} className="flex items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white/84 px-4 py-3 transition hover:border-black/20 hover:shadow-sm">
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
  if (kind === "search") return <StatusBadge label="搜人" dotClassName="bg-blue-500" className="bg-blue-50 text-blue-700 ring-blue-100" />;
  return <StatusBadge label="核验" dotClassName="bg-amber-500" className="bg-amber-50 text-amber-800 ring-amber-100" />;
}

function StatusFunnel({
  breakdown,
  total,
  current,
  onClick,
}: {
  breakdown: Record<ShortlistStatus, number>;
  total: number;
  current: ShortlistStatus | "all";
  onClick: (v: ShortlistStatus | "all") => void;
}) {
  if (total === 0) return null;
  return (
    <Surface className="p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Candidate pipeline</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">状态漏斗</h2>
        </div>
        <button
          type="button"
          onClick={() => onClick("all")}
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            current === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          全部 {total}
        </button>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {SHORT_STATUS.map((status) => {
          const count = breakdown[status.value] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const active = current === status.value;
          return (
            <button
              key={status.value}
              type="button"
              onClick={() => onClick(status.value)}
              className={`rounded-2xl border p-3 text-left transition ${
                active ? "border-[var(--sh-ink)] bg-white shadow-sm" : "border-black/10 bg-white/70 hover:border-black/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
                <span className="text-xs tabular-nums text-gray-400">{pct}%</span>
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-gray-900">{count}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div className={`h-full rounded-full ${status.dot}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>
    </Surface>
  );
}

function KpiCard({ label, value, sub, accentDot, onClick }: { label: string; value: number; sub: string; accentDot?: string; onClick?: () => void }) {
  const inner = (
    <div className="rounded-3xl border border-black/10 bg-white/82 p-4 shadow-[0_14px_42px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-1.5">
        {accentDot && <span className={`inline-block h-1.5 w-1.5 rounded-full ${accentDot}`} />}
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-[var(--sh-ink)]">{value}</p>
      <p className="text-xs text-[var(--sh-faint)]">{sub}</p>
    </div>
  );
  if (onClick) return <button onClick={onClick} className="text-left">{inner}</button>;
  return inner;
}

function ProjectHeader({ detail, onChanged, onDelete }: { detail: ProjectDetail; onChanged: () => void; onDelete: () => void }) {
  const p = detail.project;
  const [editingName, setEditingName] = useState(false);
  const [editingBrief, setEditingBrief] = useState(false);
  const [name, setName] = useState(p.name);
  const [brief, setBrief] = useState(p.brief ?? "");

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
    <Surface className="space-y-5 p-5 md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Project workspace</p>
          {editingName ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(p.name); setEditingName(false); }}}
              autoFocus
              maxLength={120}
              className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)] outline-none focus:border-black/20 md:text-5xl"
            />
          ) : (
            <h1
              onClick={() => setEditingName(true)}
              className="mt-2 cursor-text rounded-2xl text-3xl font-semibold tracking-tight text-[var(--sh-ink)] hover:bg-neutral-100 md:text-5xl"
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
            className={`appearance-none rounded-full px-3 py-1.5 text-xs font-semibold ring-1 outline-none ${meta.chip}`}
          >
            <option value="open">进行中</option>
            <option value="paused">暂停</option>
            <option value="closed">已关闭</option>
          </select>
          <IconButton label="删除项目" onClick={onDelete} Icon={FiTrash2} tone="danger" />
        </div>
      </div>

      <div className="rounded-3xl border border-black/10 bg-white/70 p-4">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">招聘需求 / brief</span>
          {!editingBrief && <button onClick={() => setEditingBrief(true)} className="text-xs font-semibold text-[var(--sh-muted)] hover:text-[var(--sh-ink)]">{p.brief ? "编辑" : "添加"}</button>}
        </div>
        {editingBrief ? (
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            onBlur={saveBrief}
            autoFocus
            rows={4}
            placeholder="粘贴 JD, 或一句话描述要找什么样的人。"
            className="block w-full resize-y rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[var(--sh-ink)] outline-none focus:border-black/20"
          />
        ) : (
          <p className={`whitespace-pre-line text-sm leading-6 ${p.brief ? "text-[var(--sh-muted)]" : "italic text-[var(--sh-faint)]"}`}>
            {p.brief || "暂无 brief — 加上之后, 在本项目下搜人会预填它"}
          </p>
        )}
      </div>
    </Surface>
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
        className={`flex w-full flex-col gap-2 rounded-3xl border bg-white/84 p-4 text-left transition ${
          selected ? "border-[var(--sh-ink)] shadow-[0_18px_48px_rgba(0,0,0,0.08)]" : "border-black/10 hover:border-black/20"
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
            <StatusBadge label={status.label} dotClassName={status.dot} className={status.chip} />
          </div>
        </div>
        {item.notes && <p className="line-clamp-2 text-xs text-gray-600">备注：{item.notes}</p>}
      </button>
    </li>
  );
}

function CandidateDetailPanel({
  item, onChanged, onDeleted, onUnassigned,
}: {
  item: ShortlistItem;
  onChanged: (patch: Partial<ShortlistItem>) => void;
  onDeleted: () => void;
  onUnassigned: () => void;
}) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savedHint, setSavedHint] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    <Surface className="space-y-4 p-5">
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
        <button onClick={unassignFromProject} className="rounded-full px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">移出项目</button>
        <IconButton label="删除候选人" onClick={handleDelete} Icon={FiTrash2} tone="danger" />
      </div>

      <button
        onClick={() => setOutreachOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sh-ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
      >
        <FiMail className="h-4 w-4" aria-hidden="true" />
        AI 起草外联邮件
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
          <span className="text-[11px] text-gray-400">{savedHint ? "已保存" : "自动保存"}</span>
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
    </Surface>
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
