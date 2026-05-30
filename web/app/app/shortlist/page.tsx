"use client";

// /app/shortlist —— 候选池(Phase 1.3 实现, 现在占位)
import Link from "next/link";

export default function ShortlistPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">候选池</h1>
        <p className="mt-1 text-sm text-gray-500">收藏的候选人、状态流、备注 —— 这一切会在 Phase 1.3 加上。</p>
      </header>

      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl ring-1 ring-emerald-100">
          📋
        </div>
        <p className="text-sm text-gray-500">即将上线:候选人收藏、状态(待联系/已联系/面试中/已 hire/已 reject)、备注、复盘。</p>
        <Link href="/app/search" className="mt-4 inline-block text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
          先开始一次搜人 →
        </Link>
      </div>
    </div>
  );
}
