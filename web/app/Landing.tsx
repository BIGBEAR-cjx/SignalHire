// Landing.tsx —— 首页落地区 (浅色 SaaS 风, 仿 Deflexai)。
// 环绕的 logo 气泡 = SignalHire 交叉验证候选人时引用的公开数据来源,
// 视觉上直接讲出差异化: 我们横跨这些来源做交叉核实。
import type { IconType } from "react-icons";
import {
  SiGithub, SiWikipedia, SiStackoverflow, SiX, SiMedium,
  SiGooglescholar, SiArxiv, SiCrunchbase, SiOrcid, SiReddit,
  SiYoutube, SiSubstack,
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

// 底部信任条用的来源 (灰度)
const STRIP: Src[] = [
  { Icon: SiGithub, color: "", label: "GitHub" },
  { Icon: FaLinkedin, color: "", label: "LinkedIn" },
  { Icon: SiWikipedia, color: "", label: "Wikipedia" },
  { Icon: SiStackoverflow, color: "", label: "Stack Overflow" },
  { Icon: SiCrunchbase, color: "", label: "Crunchbase" },
  { Icon: SiGooglescholar, color: "", label: "Scholar" },
  { Icon: SiArxiv, color: "", label: "arXiv" },
  { Icon: SiX, color: "", label: "X" },
  { Icon: SiMedium, color: "", label: "Medium" },
  { Icon: SiReddit, color: "", label: "Reddit" },
  { Icon: SiYoutube, color: "", label: "YouTube" },
  { Icon: SiSubstack, color: "", label: "Substack" },
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

export default function Landing() {
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
          <a href="#sources" className="hover:text-gray-900">数据来源</a>
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
          <div className="mb-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> 由 MiroMind 深度研究驱动
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-500" /> 跨 12+ 公开来源核实
            </span>
          </div>

          <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight text-gray-900 sm:text-6xl">
            AI 找人，<br />每句声称都查证
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-gray-600">
            MiroMind 全网深度搜索候选人，并对每条声称做跨源交叉验证——亮出可点击的证据，而不是又一份没核实的简历。
          </p>

          <div className="mt-8 flex items-center justify-center gap-3">
            <a href="#tool" className="rounded-xl bg-gray-900 px-6 py-3 font-medium text-white shadow-sm hover:bg-gray-800">
              开始搜索
            </a>
            <a href="#tool" className="rounded-xl border border-gray-300 bg-white px-6 py-3 font-medium text-gray-800 hover:border-gray-400">
              看验证示例
            </a>
          </div>

          {/* 浮动示例卡片: 验证 vs 打脸 */}
          <div className="relative mx-auto mt-12 max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-full bg-gradient-to-tr from-blue-200/40 via-emerald-100/40 to-transparent blur-2xl" />
            <div className="space-y-2 rounded-2xl border border-gray-100 bg-white/90 p-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.10)] backdrop-blur">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">Carl Lerche — Tokio 创建者</p>
                  <p className="truncate text-xs text-gray-500">Wikipedia · tokio.rs · 会议演讲</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ 已验证</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">某候选人 — 自称创建 Tokio</p>
                  <p className="truncate text-xs text-gray-500">真作者是 Carl Lerche，多源佐证</p>
                </div>
                <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">✕ 矛盾</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 信任条: 数据来源 */}
      <section id="sources" className="mx-auto max-w-5xl px-4 pb-12 text-center">
        <p className="text-sm text-gray-400">跨这些公开来源交叉验证每一条声称</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-gray-400">
          {STRIP.map((s, i) => (
            <span key={i} className="flex items-center gap-2 grayscale transition hover:grayscale-0" title={s.label}>
              <s.Icon size={22} />
              <span className="text-sm font-medium">{s.label}</span>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
