"use client";

// /app/history —— 历史研究列表。点条目 → 跳对应工具页 + 自动跑。
import Link from "next/link";
import { useEffect, useState } from "react";
import { FiCheckCircle, FiSearch } from "react-icons/fi";
import { useI18n } from "@/components/LanguageProvider";
import { EmptyState, LoadingState, PageIntro, PrimaryAction, SecondaryAction, StatusBadge } from "@/components/ui/signal-ui";

type HistoryItem = {
  kind: "search" | "verify";
  label: string;
  summary: string;
  query_text: string;
  updated_at: string;
};

export default function HistoryPage() {
  const { t } = useI18n();
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
        eyebrow={t("history.eyebrow")}
        title={t("history.title")}
        description={t("history.desc")}
      />

      {error && (
        <p className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{t("common.errorPrefix")}: {error}</p>
      )}

      {items === null && !error && (
        <LoadingState title={t("history.load")} description={t("history.loadDesc")} />
      )}

      {items && items.length === 0 && (
        <EmptyState
          title={t("history.emptyTitle")}
          description={t("history.emptyDesc")}
          action={(
            <div className="flex flex-wrap justify-center gap-2">
              <PrimaryAction href="/app/search"><FiSearch className="h-4 w-4" aria-hidden="true" />{t("nav.search")}</PrimaryAction>
              <SecondaryAction href="/app/verify"><FiCheckCircle className="h-4 w-4" aria-hidden="true" />{t("history.verifyCandidate")}</SecondaryAction>
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
                      ? <StatusBadge label={t("kind.verify")} dotClassName="bg-amber-500" className="bg-amber-50 text-amber-800 ring-amber-100" />
                      : <StatusBadge label={t("kind.search")} dotClassName="bg-blue-500" className="bg-blue-50 text-blue-700 ring-blue-100" />}
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
