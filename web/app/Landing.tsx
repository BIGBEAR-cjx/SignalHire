"use client";

// Landing.tsx —— 首页落地区 (浅色 SaaS 风, 仿 Deflexai)。
// hero 直接给搜索输入框, 缩短转化路径; 环绕 logo = 交叉验证的公开数据来源。
import { useState } from "react";
import type { IconType } from "react-icons";
import {
  SiGithub, SiWikipedia, SiStackoverflow, SiX, SiMedium,
  SiGooglescholar, SiArxiv, SiCrunchbase, SiOrcid,
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa6";

type Src = { Icon: IconType; color: string; label: string };

// 环绕气泡用的数据来源 (品牌色)
const ORBIT: (Src & { top: string; left: string; size: number })[] = [
  { Icon: SiGithub, color: "#181717", label: "GitHub", top: "20%", left: "29%", size: 56 },
  { Icon: FaLinkedin, color: "#0A66C2", label: "LinkedIn", top: "37%", left: "13%", size: 60 },
  { Icon: SiWikipedia, color: "#2B2B2B", label: "Wikipedia", top: "56%", left: "6%", size: 52 },
  { Icon: SiStackoverflow, color: "#F58025", label: "Stack Overflow", top: "73%", left: "15%", size: 54 },
  { Icon: SiGooglescholar, color: "#4285F4", label: "Google Scholar", top: "86%", left: "30%", size: 50 },
  { Icon: SiX, color: "#0F0F0F", label: "X", top: "20%", left: "69%", size: 56 },
  { Icon: SiCrunchbase, color: "#0288D1", label: "Crunchbase", top: "37%", left: "85%", size: 60 },
  { Icon: SiArxiv, color: "#B31B1B", label: "arXiv", top: "56%", left: "92%", size: 52 },
  { Icon: SiOrcid, color: "#A6CE39", label: "ORCID", top: "73%", left: "83%", size: 54 },
  { Icon: SiMedium, color: "#0F0F0F", label: "Medium", top: "86%", left: "68%", size: 50 },
];

// 品牌雷达标 (透明底, 深色描边 + 青柠中心点) —— 浅色导航/正文用。
function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g stroke="#111111" strokeWidth={22} fill="none" strokeLinecap="round">
        <circle cx="256" cy="256" r="130" />
        <circle cx="256" cy="256" r="70" />
        <path d="M186 256a70 70 0 1 0 70-70" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#9EFF4F" />
    </svg>
  );
}

function Bubble({ Icon, color, label, size }: Src & { size: number }) {
  return (
    <div
      title={label}
      className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.08)] ring-1 ring-gray-100"
      style={{ width: size, height: size }}
    >
      <Icon size={size * 0.5} color={color} />
    </div>
  );
}

export default function Landing({
  onSearch,
  onDemo,
  user,
  onLoginClick,
  onLogout,
}: {
  onSearch: (q: string) => void; // hero 输入框提交 → 跑搜人
  onDemo: () => void; // "看验证示例" → 跑候选人核验示例
  user: { email: string } | null;
  onLoginClick: () => void; // 打开登录弹窗
  onLogout: () => void; // 退出
}) {
  const [q, setQ] = useState("");
  return (
    <div className="relative overflow-hidden">
      {/* 顶部浮动导航 */}
      <nav className="sticky top-3 z-30 mx-auto mt-3 flex max-w-5xl items-center justify-between rounded-2xl border border-gray-100 bg-white/80 px-5 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
        <a href="#top" className="flex items-center gap-2 font-semibold text-gray-900">
          <LogoMark className="h-8 w-8" />
          <span className="text-[17px] tracking-tight">SignalHire</span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-gray-600 md:flex">
          <a href="/app" className="hover:text-gray-900">开始使用</a>
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
        </div>
        {user ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden max-w-[160px] truncate text-gray-500 sm:inline" title={user.email}>{user.email}</span>
            <button
              onClick={onLogout}
              className="rounded-xl border border-gray-200 px-3 py-2 font-medium text-gray-700 hover:border-gray-900"
            >
              退出
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            登录
          </button>
        )}
      </nav>

      {/* Hero */}
      <section id="top" className="relative mx-auto min-h-[760px] max-w-6xl px-4 pt-16 pb-10 text-center">
        {/* 同心环 (桌面端) */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
          {[560, 820, 1080, 1340].map((d) => (
            <div
              key={d}
              style={{ width: d, height: d }}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-200/60"
            />
          ))}
        </div>

        {/* 环绕的数据来源 logo (桌面端) */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block">
          {ORBIT.map((s, i) => (
            <div
              key={s.label}
              style={{ top: s.top, left: s.left, animationDelay: `${(i % 5) * 0.5}s` }}
              className="sh-float absolute"
            >
              <Bubble {...s} />
            </div>
          ))}
        </div>

        {/* 中央内容 */}
        <div className="sh-fade-in-up relative z-10 mx-auto max-w-2xl">
          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-6xl">
            AI 找人，<br />每句声称都查证
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600">
            MiroMind 全网深度搜索候选人，并对每条声称做跨源交叉验证——亮出可点击的证据，而不是又一份没核实的简历。
          </p>

          {/* 直接搜索输入框 (缩短转化路径; 多行大框, 完整看到长输入) */}
          <form
            className="relative mx-auto mt-9 max-w-2xl text-left"
            onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) onSearch(v); }}
          >
            <div className="absolute -inset-3 -z-10 rounded-full bg-gradient-to-tr from-blue-200/30 via-emerald-100/30 to-transparent blur-2xl" />
            <div className="rounded-2xl border border-gray-200 bg-white p-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)]">
              <textarea
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    const v = q.trim();
                    if (v) onSearch(v);
                  }
                }}
                rows={6}
                placeholder="描述你要找的人，例如：给 Tokio 贡献过代码、常驻欧洲的资深 Rust 工程师。也可以直接粘贴一段岗位要求或候选人简介。"
                aria-label="搜索候选人"
                className="block max-h-[40vh] min-h-[150px] w-full resize-y overflow-y-auto rounded-xl bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
              />
              <div className="mt-1 flex items-center justify-between gap-2 px-1">
                <span className="text-xs text-gray-400">{q.length} 字 · ⌘/Ctrl + Enter 搜索</span>
                <button type="submit" className="shrink-0 rounded-xl bg-gray-900 px-6 py-2.5 font-medium text-white hover:bg-gray-800">
                  搜索
                </button>
              </div>
            </div>
          </form>
          <button
            onClick={onDemo}
            className="mt-4 text-sm text-gray-500 underline-offset-4 transition hover:text-gray-900 hover:underline"
          >
            或查看候选人核验示例 →
          </button>
        </div>
      </section>

      <HowItWorks />
      <WhyDifferent />
      <SampleReports />
      <FinalCTA user={user} onLoginClick={onLoginClick} />
      <Footer />
    </div>
  );
}

// ───────── 如何工作 (3 步) ─────────
function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "描述你要找的人",
      desc: "一段自然语言, 不必关键词堆砌。岗位描述、候选人简介、模糊需求都行 —— SignalHire 会自动拆解成搜索意图。",
    },
    {
      n: "2",
      title: "MiroMind 全网深度核验",
      desc: "覆盖 GitHub / LinkedIn / Wikipedia / Stack Overflow / Google Scholar / arXiv / ORCID 等公开源, 对每条声称做跨源交叉证据。",
    },
    {
      n: "3",
      title: "拿到带证据的报告",
      desc: "shortlist + 跨源画像 + 红旗高亮, 每条声称都可以点开看到原始来源。再也不是「听他自己说」。",
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">如何工作</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">从需求到带证据的报告 · 几分钟</h2>
      </div>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="relative rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <span className="absolute -top-4 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white shadow-sm">
              {s.n}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-gray-600">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────── 差异化对比 ─────────
function WhyDifferent() {
  const rows: { label: string; linkedin: string; recruiter: string; signalhire: string; signalhireHi?: boolean }[] = [
    { label: "找人方式",     linkedin: "关键词匹配 + 简历筛选",   recruiter: "私人网络 + 人肉搜寻",     signalhire: "AI 全网深度研究" },
    { label: "核实声称",     linkedin: "无 · 看自述",              recruiter: "看背调, 主观",            signalhire: "跨源证据 · 自动对账", signalhireHi: true },
    { label: "速度",          linkedin: "秒",                        recruiter: "数周",                    signalhire: "几分钟" },
    { label: "成本",          linkedin: "Recruiter Lite",            recruiter: "20-25% 年薪",             signalhire: "按次研究" },
    { label: "透明度",       linkedin: "只给数据",                 recruiter: "口头汇报",                signalhire: "每条声称可点开看来源", signalhireHi: true },
  ];
  return (
    <section className="border-y border-gray-100 bg-gray-50/60 py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">为什么不一样</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">招聘的新基线: 不只是找到, 还要核实</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
            LinkedIn 给你姓名, 猎头给你介绍, SignalHire 给你<span className="font-semibold text-gray-900">证据</span>。
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">维度</th>
                <th className="px-4 py-3 font-medium text-gray-500">LinkedIn 搜索</th>
                <th className="px-4 py-3 font-medium text-gray-500">传统猎头</th>
                <th className="px-4 py-3 font-medium text-gray-900">SignalHire</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-gray-700">{r.label}</td>
                  <td className="px-4 py-3 text-gray-600">{r.linkedin}</td>
                  <td className="px-4 py-3 text-gray-600">{r.recruiter}</td>
                  <td className={`px-4 py-3 ${r.signalhireHi ? "font-semibold text-gray-900" : "text-gray-800"}`}>
                    {r.signalhireHi && <span className="mr-1">✓</span>}
                    {r.signalhire}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ───────── 示例报告 (公开 /r/[id]) ─────────
function SampleReports() {
  const samples: { id: string; kind: "search" | "verify"; title: string; desc: string; tag: string }[] = [
    {
      id: "11e6f828-aaa7-43cd-aaad-88200b532e80",
      kind: "search",
      title: "13 位 AI / LLM Infra 候选人",
      desc: "一句话 brief → MiroMind 全网研究 → 候选人按匹配度排序的 shortlist。",
      tag: "搜人 · shortlist",
    },
    {
      id: "7db220df-f1ff-4258-b715-9a14f4505507",
      kind: "verify",
      title: "Jordan Smith · 4 处红旗",
      desc: "候选人自述\"Tokio 原创者、Google Staff、Stanford CS PhD\" —— 跨源核实后揭示 4 处与原始来源矛盾。",
      tag: "核验 · 打脸",
    },
    {
      id: "2ed1d119-d1a7-4dd9-a26a-82236e9e4013",
      kind: "verify",
      title: "Marcus Webb · 4 处红旗",
      desc: "另一份 distinguished engineer 自述, 跨源比对发现职称、成就、时间线都对不上。",
      tag: "核验 · 打脸",
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">示例报告</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">点开看真实输出</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">三份真实产出。无需登录, 直接看 SignalHire 给你的核实级 shortlist 和打脸报告。</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {samples.map((s) => (
          <a
            key={s.id}
            href={`/r/${s.id}`}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)]"
          >
            <span className={`mb-3 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
              s.kind === "search"
                ? "bg-blue-50 text-blue-700 ring-blue-100"
                : "bg-amber-50 text-amber-800 ring-amber-100"
            }`}>
              {s.tag}
            </span>
            <h3 className="text-base font-semibold text-gray-900">{s.title}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-gray-600">{s.desc}</p>
            <span className="mt-3 text-sm font-medium text-gray-900 group-hover:underline">查看完整报告 →</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ───────── 末位 CTA ─────────
function FinalCTA({ user, onLoginClick }: { user: { email: string } | null; onLoginClick: () => void }) {
  return (
    <section className="border-t border-gray-100 bg-gradient-to-b from-white to-gray-50 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          停止猜。<span className="text-gray-500">开始查证。</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">
          每次招聘决定都该有证据。免费试用,从第一份带证据的报告开始。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <a href="/app" className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-gray-800">
              进入控制台 →
            </a>
          ) : (
            <button onClick={onLoginClick} className="rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-gray-800">
              免费试用 →
            </button>
          )}
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-medium text-gray-700 hover:border-gray-900">
            看 GitHub
          </a>
        </div>
      </div>
    </section>
  );
}

// ───────── Footer ─────────
function Footer() {
  return (
    <footer className="border-t border-gray-100 py-10">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <LogoMark className="h-5 w-5" />
          <span className="font-medium text-gray-700">SignalHire</span>
          <span>· AI 找人, 每句声称都查证</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
          <span>© 2026</span>
        </div>
      </div>
    </footer>
  );
}
