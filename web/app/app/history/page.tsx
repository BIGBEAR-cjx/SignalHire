"use client";

// /app/history —— 历史研究列表。点条目 → 跳对应工具页 + 自动跑。
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiCheckCircle, FiSearch } from "react-icons/fi";
import { EmptyState, PageIntro, PrimaryAction, SecondaryAction, StatusBadge } from "@/components/ui/signal-ui";

type HistoryItem = {
  kind: "search" | "verify";
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
};

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then((j) => setItems(j.runs ?? []))
      .catch((e) => setError((e as Error).message));
  }, []);

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Research history"
        title="重新打开每一次人才研究。"
        description="回看已完成的 shortlist 和核验报告，或用同一画像快速开始下一轮搜索。"
      />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>
      )}

      {items === null && !error && (
        <p className="text-sm text-gray-400">加载中…</p>
      )}

      {items && items.length === 0 && (
        <EmptyState
          title="还没有研究记录"
          description="先开始一次搜人或核验，完成后的研究会出现在这里。"
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <PrimaryAction href="/app/search"><FiSearch className="h-4 w-4" aria-hidden="true" />智能搜人</PrimaryAction>
              <SecondaryAction href="/app/verify"><FiCheckCircle className="h-4 w-4" aria-hidden="true" />核验候选人</SecondaryAction>
            </div>
          )}
        />
      )}

      {items && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((h, i) => {
            const target = h.kind === "search"
              ? `/app/search?q=${encodeURIComponent(h.query_text)}`
              : `/app/verify?bio=${encodeURIComponent(h.query_text)}`;
            return (
              <li key={i}>
                <Link
                  href={target}
                  className="flex items-center justify-between gap-3 rounded-3xl border border-black/10 bg-white/84 px-4 py-3 transition hover:border-black/20 hover:shadow-sm"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    {h.kind === "verify"
                      ? <StatusBadge label="核验" dotClassName="bg-amber-500" className="bg-amber-50 text-amber-800 ring-amber-100" />
                      : <StatusBadge label="搜人" dotClassName="bg-blue-500" className="bg-blue-50 text-blue-700 ring-blue-100" />}
                    <span className="min-w-0 truncate text-sm text-gray-800" title={h.query_text}>
                      {h.label}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-gray-400">{h.summary}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
