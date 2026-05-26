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
}: {
  onSearch: (q: string) => void; // hero 输入框提交 → 跑搜人
  onDemo: () => void; // "看验证示例" → 跑打脸 demo
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
          <a href="#tool" className="hover:text-gray-900">开始使用</a>
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
        </div>
        <a href="#tool" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">
          开始搜索
        </a>
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
                rows={8}
                placeholder="描述你要找的人，例如：给 Tokio 贡献过代码、常驻欧洲的资深 Rust 工程师。也可以直接粘贴一整段岗位要求或候选人简介——框够大，完整看得到。"
                aria-label="搜索候选人"
                className="block max-h-[60vh] min-h-[200px] w-full resize-y rounded-xl bg-transparent px-3 py-2.5 text-[15px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400"
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
            或看一个验证示例（打脸）→
          </button>
        </div>
      </section>
    </div>
  );
}
