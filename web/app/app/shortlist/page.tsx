"use client";

// /app/shortlist —— 候选池(Phase 1.3)
// 卡片列表 + 状态筛选 + 状态切换 + 备注 + 详情抽屉 + 删除
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FiMail, FiPlus, FiTrash2 } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { CandidateProfileView } from "@/components/result";
import OutreachModal from "@/components/OutreachModal";
import {
  EmptyState,
  IconButton,
  LoadingState,
  PageIntro,
  PrimaryAction,
  SegmentedControl,
  StatusBadge,
  Surface,
} from "@/components/ui/signal-ui";
import { buildCandidateDecisionSignal } from "@/lib/evidence-priority.mjs";
import type { TalentCandidate } from "@/lib/talent-profile.mjs";

type Status = "new" | "contacted" | "interviewing" | "hired" | "rejected";
const STATUSES: { value: Status; labelKey: string; chipCls: string; dotCls: string }[] = [
  { value: "new",          labelKey: "shortlist.status.new",          chipCls: "bg-gray-100 text-gray-700 ring-gray-200",        dotCls: "bg-gray-400" },
  { value: "contacted",    labelKey: "shortlist.status.contacted",    chipCls: "bg-blue-50 text-blue-700 ring-blue-200",         dotCls: "bg-blue-500" },
  { value: "interviewing", labelKey: "shortlist.status.interviewing", chipCls: "bg-amber-50 text-amber-800 ring-amber-200",      dotCls: "bg-amber-500" },
  { value: "hired",        labelKey: "shortlist.status.hired",        chipCls: "bg-emerald-50 text-emerald-700 ring-emerald-200", dotCls: "bg-emerald-500" },
  { value: "rejected",     labelKey: "shortlist.status.rejected",     chipCls: "bg-rose-50 text-rose-700 ring-rose-200",         dotCls: "bg-rose-400" },
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
  const { t } = useI18n();
  const meta = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
  return <StatusBadge label={t(meta.labelKey)} dotClassName={meta.dotCls} className={meta.chipCls} />;
}

export default function ShortlistPage() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/shortlist");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "加载失败");
      setItems((j.items ?? []) as Item[]);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]); // eslint-disable-line react-hooks/set-state-in-effect

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
      <PageIntro
        eyebrow={t("shortlist.eyebrow")}
        title={t("shortlist.title")}
        description={t("shortlist.desc")}
        actions={(
          <PrimaryAction href="/app/search">
            <FiPlus className="h-4 w-4" aria-hidden="true" />
            {t("shortlist.newSearch")}
          </PrimaryAction>
        )}
      />

      {error && <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{t("common.errorPrefix")}: {error}</p>}

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        items={[
          { value: "all", label: t("common.all"), count: counts.all },
          ...STATUSES.map((s) => ({ value: s.value, label: t(s.labelKey), count: counts[s.value] ?? 0 })),
        ]}
      />

      {items === null && !error && (
        <LoadingState title={t("shortlist.load")} description={t("shortlist.loadDesc")} />
      )}

      {/* 空状态 */}
      {items && items.length === 0 && (
        <EmptyState
          title={t("shortlist.emptyTitle")}
          description={t("shortlist.emptyDesc")}
          action={<PrimaryAction href="/app/search"><FiPlus className="h-4 w-4" aria-hidden="true" />{t("nav.search")}</PrimaryAction>}
        />
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
                locale={locale}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
              />
            ))}
            {filtered.length === 0 && (
              <li><EmptyState title={t("shortlist.noFiltered")} description={t("shortlist.noFilteredDesc")} /></li>
            )}
          </ul>

          {/* 详情面板 */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            {selected ? (
              <DetailPanel
                key={selected.id}
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
              <div className="rounded-3xl border border-dashed border-black/10 bg-white/80 p-6 text-sm text-[var(--sh-muted)]">
                {t("shortlist.selectHint")}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, locale, selected, onClick }: { item: Item; locale: "zh" | "en"; selected: boolean; onClick: () => void }) {
  const { t } = useI18n();
  const c = asCandidate(item.candidate);
  const subtitle = [c.current_role, c.current_company].filter(Boolean).join(" · ") || c.headline || "";
  const signal = buildCandidateDecisionSignal({ candidate: item.candidate, locale, status: item.status });
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
            <p className="truncate text-sm font-semibold text-gray-900">{c.name || t("shortlist.unknownName")}</p>
            {subtitle && <p className="mt-0.5 truncate text-xs text-gray-500">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusChip status={item.status} />
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[signal.match, signal.evidence, signal.sources].map((metric) => (
            <span key={metric.key} className="rounded-2xl bg-gray-50 px-3 py-2 ring-1 ring-black/5">
              <span className="block text-[11px] font-medium text-gray-500">{metric.label}</span>
              <span className="mt-0.5 block text-xs font-semibold tabular-nums text-gray-900">{metric.value}</span>
            </span>
          ))}
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-gray-500">{signal.hint}</p>
        {(c.ai_directions?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1">
            {(c.ai_directions ?? []).slice(0, 3).map((d) => (
              <span key={d} className="rounded-full bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-100">{d}</span>
            ))}
          </div>
        )}
        {item.notes && (
          <p className="line-clamp-2 text-xs text-gray-600">{t("shortlist.notesPrefix", { notes: item.notes })}</p>
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
  const { t, locale } = useI18n();
  const [savingStatus, setSavingStatus] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [savedHint, setSavedHint] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function patch(body: { status?: Status; notes?: string | null }) {
    const r = await fetch(`/api/shortlist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || t("common.errorPrefix"));
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
    if (!confirm(t("shortlist.removeConfirm"))) return;
    const r = await fetch(`/api/shortlist/${item.id}`, { method: "DELETE" });
    if (r.ok) onDeleted();
  }

  const candidate = item.candidate;
  const isTalent = isTalentShape(candidate);

  return (
    <Surface className="space-y-4 p-5">
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
            {t(s.labelKey)}
          </button>
        ))}
        <span className="flex-1" />
        <IconButton label={t("shortlist.remove")} onClick={handleDelete} Icon={FiTrash2} tone="danger" />
      </div>

      <button
        onClick={() => setOutreachOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sh-ink)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-black"
      >
        <FiMail className="h-4 w-4" aria-hidden="true" />
        {t("shortlist.outreach")}
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
          <label className="text-xs font-medium text-gray-600">{t("shortlist.notes")}</label>
          <span className="text-[11px] text-gray-400">{savedHint ? t("shortlist.saved") : t("shortlist.autosave")}</span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          placeholder={t("shortlist.notesPlaceholder")}
          className="block w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
        />
      </div>

      {/* 来源 + 时间 */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{t("shortlist.addedAt", { date: new Date(item.created_at).toLocaleString(locale === "en" ? "en-US" : "zh-CN") })}</span>
        {item.source_run_id && (
          <Link href={`/app/history`} className="text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
            {t("shortlist.sourceHistory")}
          </Link>
        )}
      </div>

      {/* 候选人画像 */}
      <div className="border-t border-gray-100 pt-4">
        {isTalent ? (
          <CandidateProfileView candidate={candidate as TalentCandidate} locale={locale} />
        ) : (
          <LegacyCandidateView candidate={candidate} />
        )}
      </div>
    </Surface>
  );
}

function LegacyCandidateView({ candidate }: { candidate: unknown }) {
  const { t } = useI18n();
  const c = asCandidate(candidate);
  return (
    <div className="space-y-3 text-sm">
      <h2 className="text-lg font-semibold text-gray-900">{c.name || t("shortlist.unknownName")}</h2>
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
