"use client";

// 控制台总览页(Phase 1.4 才填实功能, 现在先给最简占位)
import Link from "next/link";

const QUICK_ACTIONS = [
  {
    href: "/app/search",
    icon: "🔍",
    title: "智能搜人",
    desc: "给一段招聘需求, MiroMind 全网帮你找 10-15 个候选人, 并自动核验关键声称。",
    cta: "开始搜人 →",
    accent: "bg-blue-50 ring-blue-100 text-blue-700",
  },
  {
    href: "/app/verify",
    icon: "✅",
    title: "核验台",
    desc: "粘贴一个候选人的自述/简历/LinkedIn, 我们对每条声称做跨源核实, 揭示红旗。",
    cta: "核验候选人 →",
    accent: "bg-amber-50 ring-amber-100 text-amber-800",
  },
  {
    href: "/app/shortlist",
    icon: "📋",
    title: "候选池",
    desc: "管理你收藏的候选人, 标记状态、备注、复盘报告。",
    cta: "查看候选池 →",
    accent: "bg-emerald-50 ring-emerald-100 text-emerald-700",
  },
];

export default function Overview() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">欢迎回来 👋</h1>
        <p className="mt-1 text-sm text-gray-500">从下面选一个动作开始,或从左侧导航进入功能。</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
          >
            <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg ring-1 ${a.accent}`}>
              {a.icon}
            </div>
            <h2 className="text-base font-semibold text-gray-900">{a.title}</h2>
            <p className="mt-1 flex-1 text-sm text-gray-500">{a.desc}</p>
            <span className="mt-4 text-sm font-medium text-gray-900 group-hover:underline">{a.cta}</span>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">控制台总览、KPI、进行中任务面板等会在 Phase 1.4 加上。</p>
        <Link href="/app/history" className="mt-2 inline-block text-sm font-medium text-gray-900 underline-offset-4 hover:underline">
          先看历史研究 →
        </Link>
      </section>
    </div>
  );
}
