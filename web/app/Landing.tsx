"use client";

// Landing.tsx —— 公开首页。
// hero 直接给搜索输入框, 缩短转化路径; 首屏展示产品真实产出形态。
import { useState } from "react";
import { FiArrowRight, FiCheckCircle, FiGithub, FiSearch, FiShield, FiUsers } from "react-icons/fi";
import { LogoMark, SecondaryAction } from "@/components/ui/signal-ui";

function ProductHeroVisual() {
  const candidates = [
    { name: "Ava Chen", role: "LLM 系统负责人", score: 94, evidence: "8 个信源" },
    { name: "Mateo Rossi", role: "推理运行时工程师", score: 89, evidence: "6 个信源" },
    { name: "Nora Singh", role: "AI Infra 研究员", score: 86, evidence: "7 个信源" },
  ];
  const sources = ["GitHub", "arXiv", "Scholar", "LinkedIn", "公司页面"];
  return (
    <div className="mx-auto mt-12 max-w-6xl text-left">
      <div className="relative overflow-hidden rounded-[34px] border border-black/10 bg-white/86 p-2 shadow-[0_28px_90px_rgba(0,0,0,0.1)] backdrop-blur-2xl">
        <div className="flex items-center justify-between rounded-t-[26px] border-b border-black/5 bg-white/78 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          </div>
          <div className="hidden rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-medium text-[var(--sh-muted)] sm:block">
            SignalHire 研究工作台
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">证据链完成</span>
        </div>
        <div className="grid gap-0 overflow-hidden rounded-b-[26px] bg-[#f5f5f7] lg:grid-cols-[0.88fr_1.12fr]">
          <div className="border-b border-black/5 bg-white/58 p-5 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-[var(--sh-blue)] ring-1 ring-blue-100">
                <FiSearch className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sh-faint)]">人才画像</p>
                <h2 className="text-xl font-semibold text-[var(--sh-ink)]">欧洲 AI Infra 负责人</h2>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--sh-muted)]">
              找到在开源推理框架有真实贡献、能带生产系统落地、近期可能考虑机会的资深候选人。
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {sources.map((source) => (
                <span key={source} className="rounded-full bg-white/84 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10">
                  {source}
                </span>
              ))}
            </div>
            <div className="mt-6 space-y-3">
              {["拆解岗位画像", "扩展公开信源", "交叉核验证据"].map((step, index) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-white/82 px-3 py-3 ring-1 ring-black/5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-semibold text-white">{index + 1}</span>
                  <span className="text-sm font-medium text-[var(--sh-ink)]">{step}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-white/86 p-4 ring-1 ring-black/5">
                <FiUsers className="h-5 w-5 text-[var(--sh-blue)]" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">13</p>
                <p className="text-xs text-[var(--sh-muted)]">候选名单</p>
              </div>
              <div className="rounded-3xl bg-white/86 p-4 ring-1 ring-black/5">
                <FiShield className="h-5 w-5 text-emerald-600" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">82%</p>
                <p className="text-xs text-[var(--sh-muted)]">关键声称已核实</p>
              </div>
              <div className="rounded-3xl bg-white/86 p-4 ring-1 ring-black/5">
                <FiCheckCircle className="h-5 w-5 text-amber-600" aria-hidden="true" />
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">4</p>
                <p className="text-xs text-[var(--sh-muted)]">需要追问的风险点</p>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-3xl bg-white/90 ring-1 ring-black/5">
              {candidates.map((candidate, index) => (
                <div key={candidate.name} className="flex items-center justify-between gap-4 border-b border-black/5 px-4 py-3 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--sh-ink)]">{candidate.name}</p>
                    <p className="mt-0.5 truncate text-xs text-[var(--sh-muted)]">{candidate.role}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="hidden text-xs text-[var(--sh-muted)] sm:inline">{candidate.evidence}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      index === 0 ? "bg-neutral-950 text-white" : "bg-neutral-100 text-[var(--sh-muted)]"
                    }`}>
                      {candidate.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-3xl bg-neutral-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">证据摘要</p>
              <p className="mt-3 text-lg font-semibold">每位候选人的论文、开源、工作经历和公开影响力都被转译成中文结论。</p>
              <p className="mt-2 text-sm leading-6 text-white/62">招聘团队不用逐页读英文资料，也能看到来源、置信度和下一步追问建议。</p>
            </div>
          </div>
        </div>
      </div>
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
      <nav className="sticky top-3 z-30 mx-auto mt-3 flex max-w-5xl items-center justify-between rounded-full border border-black/5 bg-white/72 px-5 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.06)] backdrop-blur-2xl">
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
              className="rounded-full border border-black/10 px-3 py-2 font-medium text-[var(--sh-muted)] hover:border-black/20 hover:text-[var(--sh-ink)]"
            >
              退出
            </button>
          </div>
        ) : (
          <button
            onClick={onLoginClick}
            className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            登录
          </button>
        )}
      </nav>

      {/* Hero */}
      <section id="top" className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center">
        {/* 中央内容 */}
        <div className="sh-fade-in-up relative z-10 mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-[var(--sh-muted)]">为 HR 和猎头打造的 AI 人才搜索平台</p>
          <h1 className="mt-4 text-5xl font-semibold leading-[1.04] text-[var(--sh-ink)] sm:text-7xl">
            AI 人才搜索，从证据开始。
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--sh-muted)]">
            为 HR 和猎头生成全球 AI 人才候选名单、交叉验证证据和候选人风险摘要。
          </p>

          {/* 直接搜索输入框 (缩短转化路径; 多行大框, 完整看到长输入) */}
          <form
            className="relative mx-auto mt-9 max-w-2xl text-left"
            onSubmit={(e) => { e.preventDefault(); const v = q.trim(); if (v) onSearch(v); }}
          >
            <div className="sh-surface p-2.5">
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
                className="block max-h-[40vh] min-h-[150px] w-full resize-y overflow-y-auto rounded-[18px] bg-white/70 px-3 py-2.5 text-[15px] leading-relaxed text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
              />
              <div className="mt-1 flex items-center justify-between gap-2 px-1">
                <span className="text-xs text-[var(--sh-faint)]">已输入 {q.length} 字</span>
                <button type="submit" className="sh-primary-action shrink-0 px-6">
                  搜索
                </button>
              </div>
            </div>
          </form>
          <div className="mt-4 flex justify-center">
            <SecondaryAction onClick={onDemo}>查看候选人核验示例</SecondaryAction>
          </div>
        </div>
        <ProductHeroVisual />
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
      title: "多源全网深度核验",
      desc: "覆盖 GitHub / LinkedIn / Wikipedia / Stack Overflow / Google Scholar / arXiv / ORCID 等公开源, 对每条声称做跨源交叉证据。",
    },
    {
      n: "3",
      title: "拿到带证据的报告",
      desc: "候选名单 + 跨源画像 + 红旗高亮，每条声称都可以点开看到原始来源。再也不是「听他自己说」。",
    },
  ];
  return (
    <section className="mx-auto max-w-5xl px-4 py-20">
      <div className="mb-12 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">如何工作</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)] sm:text-4xl">从需求到带证据的报告，几分钟</h2>
      </div>
      <ol className="grid gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <li key={s.n} className="relative rounded-[28px] border border-black/10 bg-white/84 p-6 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
            <span className="absolute -top-4 left-6 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sh-ink)] text-sm font-semibold text-white shadow-sm">
              {s.n}
            </span>
            <h3 className="mt-2 text-lg font-semibold text-[var(--sh-ink)]">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[var(--sh-muted)]">{s.desc}</p>
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
    <section className="border-y border-black/5 bg-white/45 py-20">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">为什么不一样</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)] sm:text-4xl">招聘的新基线: 不只是找到, 还要核实</h2>
          <p className="mx-auto mt-4 max-w-2xl text-base text-gray-600">
            LinkedIn 给你姓名, 猎头给你介绍, SignalHire 给你<span className="font-semibold text-gray-900">证据</span>。
          </p>
        </div>
        <div className="overflow-hidden rounded-[28px] border border-black/10 bg-white/86 shadow-[0_18px_52px_rgba(0,0,0,0.06)]">
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
                    {r.signalhireHi && <FiCheckCircle className="mr-1 inline h-4 w-4 text-emerald-600" aria-hidden="true" />}
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
      desc: "一句话画像，SignalHire 全网研究，候选人按匹配度排序输出候选名单。",
      tag: "搜人 · 候选名单",
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
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">三份真实产出。无需登录，直接看 SignalHire 给你的核实级候选名单和证据报告。</p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {samples.map((s) => (
          <a
            key={s.id}
            href={`/r/${s.id}`}
            target="_blank"
            rel="noreferrer"
            className="group flex flex-col rounded-[28px] border border-black/10 bg-white/86 p-5 shadow-[0_18px_52px_rgba(0,0,0,0.06)] transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_24px_68px_rgba(0,0,0,0.1)]"
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
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gray-900 group-hover:underline">
              查看完整报告
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

// ───────── 末位 CTA ─────────
function FinalCTA({ user, onLoginClick }: { user: { email: string } | null; onLoginClick: () => void }) {
  return (
    <section className="border-t border-black/5 bg-white/55 py-20">
      <div className="mx-auto max-w-3xl px-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
          停止猜。<span className="text-gray-500">开始查证。</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-gray-600">
          每次招聘决定都该有证据。免费试用,从第一份带证据的报告开始。
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {user ? (
            <a href="/app" className="sh-primary-action px-6">
              进入控制台
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ) : (
            <button onClick={onLoginClick} className="sh-primary-action px-6">
              免费试用
              <FiArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
          <a href="https://github.com/BIGBEAR-cjx/SignalHire" target="_blank" rel="noreferrer" className="sh-secondary-action px-6">
            <FiGithub className="h-4 w-4" aria-hidden="true" />
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
