"use client";

// /app/history —— 历史研究列表。点条目 → 跳对应工具页 + 自动跑。
import Link from "next/link";
import { useEffect, useState } from "react";

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
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">历史研究</h1>
        <p className="mt-1 text-sm text-gray-500">点任意一条秒速重新打开已完成的 shortlist 或核验报告。</p>
      </header>

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">出错: {error}</p>
      )}

      {items === null && !error && (
        <p className="text-sm text-gray-400">加载中…</p>
      )}

      {items && items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-500">还没有研究记录。先开始一次搜人或核验。</p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/app/search" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
              智能搜人
            </Link>
            <Link href="/app/verify" className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-900">
              核验候选人
            </Link>
          </div>
        </div>
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
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition hover:border-blue-400 hover:shadow-sm"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                        h.kind === "verify"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {h.kind === "verify" ? "核验" : "搜人"}
                    </span>
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
