"use client";

// /app/shortlist —— 候选池(Phase 1.3)
// 卡片列表 + 状态筛选 + 状态切换 + 备注 + 详情抽屉 + 删除
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CandidateProfileView } from "@/components/result";
import OutreachModal from "@/components/OutreachModal";
import type { TalentCandidate } from "@/lib/talent-profile.mjs";

type Status = "new" | "contacted" | "interviewing" | "hired" | "rejected";
const STATUSES: { value: Status; label: string; chipCls: string; dotCls: string }[] = [
  { value: "new",          label: "待联系",   chipCls: "bg-gray-100 text-gray-700 ring-gray-200",        dotCls: "bg-gray-400" },
  { value: "contacted",    label: "已联系",   chipCls: "bg-blue-50 text-blue-700 ring-blue-200",         dotCls: "bg-blue-500" },
  { value: "interviewing", label: "面试中",   chipCls: "bg-amber-50 text-amber-800 ring-amber-200",      dotCls: "bg-amber-500" },
  { value: "hired",        label: "已 hire", chipCls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dotCls: "bg-emerald-500" },
  { value: "rejected",     label: "已拒",     chipCls: "bg-rose-50 text-rose-700 ring-rose-200",         dotCls: "bg-rose-400" },
];

interface Item {
  id: string;
  source_run_id: string | null;
  candidate: unknown;
  status: Status;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// 安全取候选人字段 (兼容 TalentCandidate / 旧 Candidate)
type CandidateLike = {
  name?: string;
  headline?: string;
  current_role?: string | null;
  current_company?: string | null;
  location?: string | null;
  match_score?: number;
  links?: { github?: string | null; linkedin?: string | null; scholar?: string | null; website?: string | null };
  summary?: string;
  ai_directions?: string[];
};
function asCandidate(x: unknown): CandidateLike {
  return (x ?? {}) as CandidateLike;
}
function isTalentShape(x: unknown): x is TalentCandidate {
  const c = asCandidate(x);
  return typeof c.match_score === "number" && Array.isArray(c.ai_directions);
}

function StatusChip({ status }: { status: Status }) {
  const meta = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${meta.chipCls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dotCls}`} />
      {meta.label}
    </span>
  );
}

export default function ShortlistPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { reload(); }, []);

  async function reload() {
    try {
      const r = await fetch("/api/shortlist");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "加载失败");
      setItems((j.items ?? []) as Item[]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const filtered = useMemo(() => {
    if (!items) return [];
    if (filter === "all") return items;
    return items.filter((it) => it.status === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items?.length ?? 0 };
    for (const s of STATUSES) c[s.value] = 0;
    for (const it of items ?? []) c[it.status] = (c[it.status] ?? 0) + 1;
    return c;
  }, [items]);

  const selected = useMemo(() => filtered.find((it) => it.id === selectedId) ?? null, [filtered, selectedId]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">候选池</h1>
          <p className="mt-1 text-sm text-gray-500">已收藏的候选人, 标状态、记备注、随时回到原次搜索。</p>
        </div>
        <Link href="/app/search" className="rounded-xl bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800">
          + 新建搜人
        </Link>
      </header>

      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>}

      {/* 筛选条 */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterTab value="all" current={filter} onClick={setFilter} label="全部" count={counts.all} />
        {STATUSES.map((s) => (
          <FilterTab key={s.value} value={s.value} current={filter} onClick={setFilter} label={s.label} count={counts[s.value] ?? 0} />
        ))}
      </div>

      {/* 加载中 */}
      {items === null && !error && <p className="text-sm text-gray-400">加载中…</p>}

      {/* 空状态 */}
      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl ring-1 ring-emerald-100">📋</div>
          <p className="text-sm text-gray-500">候选池还是空的。先做一次搜人, 点候选人卡上的「★」收藏。</p>
          <Link href="/app/search" className="mt-4 inline-block text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
            智能搜人 →
          </Link>
        </div>
      )}

      {/* 卡片网格 (左) + 详情抽屉 (右) */}
      {items && items.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.85fr)]">
          {/* 列表 */}
          <ul className="space-y-3">
            {filtered.map((it) => (
              <ItemCard
                key={it.id}
                item={it}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
              />
            ))}
            {filtered.length === 0 && (
              <li className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
                这个状态下没有候选人。
              </li>
            )}
          </ul>

          {/* 详情面板 */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {selected ? (
              <DetailPanel
                item={selected}
                onChanged={(patch) => {
                  setItems((prev) => prev?.map((it) => it.id === selected.id ? { ...it, ...patch } : it) ?? prev);
                }}
                onDeleted={() => {
                  setItems((prev) => prev?.filter((it) => it.id !== selected.id) ?? prev);
                  setSelectedId(null);
                }}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-sm text-gray-500">
                点左侧卡片查看候选人画像、改状态、写备注。
              </div>
            )}
          </div>
        </div>
      )}
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

function ItemCard({ item, selected, onClick }: { item: Item; selected: boolean; onClick: () => void }) {
  const c = asCandidate(item.candidate);
  const subtitle = [c.current_role, c.current_company].filter(Boolean).join(" · ") || c.headline || "";
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
              <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-gray-700">
                {c.match_score}
              </span>
            )}
            <StatusChip status={item.status} />
          </div>
        </div>
        {(c.ai_directions?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(c.ai_directions ?? []).slice(0, 3).map((d) => (
              <span key={d} className="rounded-full bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-100">{d}</span>
            ))}
          </div>
        )}
        {item.notes && (
          <p className="line-clamp-2 text-xs text-gray-600">📝 {item.notes}</p>
        )}
      </button>
    </li>
  );
}

function DetailPanel({
  item,
  onChanged,
  onDeleted,
}: {
  item: Item;
  onChanged: (patch: Partial<Item>) => void;
  onDeleted: () => void;
}) {
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savedHint, setSavedHint] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 切换候选人时重置 textarea
  useEffect(() => { setNotes(item.notes ?? ""); }, [item.id, item.notes]);

  async function patch(body: { status?: Status; notes?: string | null }) {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "更新失败");
  }

  async function setStatus(next: Status) {
    if (next === item.status || savingStatus) return;
    setSavingStatus(true);
    const prev = item.status;
    onChanged({ status: next });
    try {
      await patch({ status: next });
    } catch {
      onChanged({ status: prev });
    } finally {
      setSavingStatus(false);
    }
  }

  // notes 防抖自动保存 (800ms)
  const saveNotes = useCallback(async (value: string) => {
    try {
      await patch({ notes: value });
      onChanged({ notes: value });
      setSavedHint(true);
      setTimeout(() => setSavedHint(false), 1500);
    } catch {
      // 静默
    }
  }, [item.id]);  // eslint-disable-line react-hooks/exhaustive-deps

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

  const candidate = item.candidate;
  const isTalent = isTalentShape(candidate);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
      {/* 状态切换 + 工具栏 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            disabled={savingStatus}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
              item.status === s.value
                ? "bg-gray-900 text-white"
                : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-gray-900"
            }`}
          >
            {s.label}
          </button>
        ))}
        <span className="flex-1" />
        <button onClick={handleDelete} className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50">
          移出候选池
        </button>
      </div>

      {/* AI 外联 CTA (Phase 2.A.3) */}
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
          className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
        />
      </div>

      {/* 来源 + 时间 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>添加于 {new Date(item.created_at).toLocaleString("zh-CN")}</span>
        {item.source_run_id && (
          <Link href={`/app/history`} className="text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
            来源:历史
          </Link>
        )}
      </div>

      {/* 候选人画像 */}
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
      {c.summary && <p className="whitespace-pre-line text-gray-700">{c.summary}</p>}
      {c.links && Object.entries(c.links).some(([, v]) => v) && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(c.links).map(([k, v]) => v ? (
            <a key={k} href={v as string} target="_blank" rel="noreferrer" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-200">
              {k}
            </a>
          ) : null)}
        </div>
      )}
    </div>
  );
}
