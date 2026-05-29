// app/r/[id]/page.tsx —— 可分享的只读核实报告 (服务端渲染, 公开)。
// 把一条 research_runs 渲染成"带证据的核实报告", 可直接发给客户/投资人。
import Link from "next/link";
import type { Metadata } from "next";
import { getRunById } from "@/lib/db";
import {
  CandidateCard,
  CandidateProfileView,
  TalentMapView,
  TrustReportView,
  type Candidate,
  type VerifyReport,
} from "@/components/result";
import type { TalentSearchResult } from "@/lib/talent-profile.mjs";

export const runtime = "nodejs";

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

function isTalentSearchResult(result: unknown): result is TalentSearchResult {
  return Boolean(
    result &&
      typeof result === "object" &&
      Array.isArray((result as Partial<TalentSearchResult>).talent_map) &&
      Array.isArray((result as Partial<TalentSearchResult>).candidates) &&
      "search_brief" in result,
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = await getRunById(id);
  if (!row) return { title: "报告不存在 · SignalHire" };
  return {
    title: `${row.label} — 核实报告 · SignalHire`,
    description: row.summary || (
      row.kind === "search"
        ? "SignalHire 生成的 AI 人才 shortlist 与公开证据报告。"
        : "SignalHire 生成的候选人证据审计报告。"
    ),
  };
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await getRunById(id);
  const cta = row?.kind === "verify"
    ? {
        title: "想审计你自己的候选人证据？",
        body: "SignalHire 从公开来源交叉验证候选人声称，标出已验证、未验证和矛盾点。",
        button: "开始审计候选人 →",
      }
    : {
        title: "想为你的 AI 岗位生成这样的 shortlist？",
        body: "SignalHire 从公开来源搜索全球 AI 人才，并把论文、开源、实践和工作经历证据整理成可交付报告。",
        button: "生成 AI 人才 shortlist →",
      };

  return (
    <div className="min-h-full">
      {/* 顶栏 */}
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900">
          <LogoMark className="h-8 w-8" />
          <span className="text-[17px] tracking-tight">SignalHire</span>
        </Link>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">AI 人才报告</span>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-20">
        {!row ? (
          <div className="mt-10 rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <p className="text-lg font-semibold text-gray-900">报告不存在或链接已失效</p>
            <p className="mt-1 text-sm text-gray-500">这条核实记录找不到了。</p>
            <Link href="/" className="mt-5 inline-block rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800">
              去 SignalHire 验证候选人 →
            </Link>
          </div>
        ) : (
          <>
            {/* 上下文 */}
            <div className="mt-2">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                {row.kind === "search" ? "岗位画像" : "候选人证据审计"}
              </p>
              <blockquote className="mt-2 whitespace-pre-line rounded-xl border-l-2 border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                {row.query_text}
              </blockquote>
              <p className="mt-2 text-xs text-gray-400">
                SignalHire 基于公开来源生成 · 候选人按 AI 方向分层 · 关键结论附可点击证据
              </p>
            </div>

            {/* 结果 */}
            <div className="mt-6 space-y-4">
              {row.kind === "search" ? (
                isTalentSearchResult(row.result) ? (
                  <>
                    <TalentMapView result={row.result} />
                    {(row.result as TalentSearchResult).candidates.map((candidate, index) => (
                      <CandidateProfileView key={`${candidate.name}-${index}`} candidate={candidate} />
                    ))}
                  </>
                ) : (
                  ((row.result as { candidates?: Candidate[] })?.candidates ?? []).map((c, i) => (
                    <CandidateCard key={i} c={c} delay={i * 90} />
                  ))
                )
              ) : (
                <TrustReportView r={row.result as VerifyReport} />
              )}
            </div>

            {/* CTA */}
            <div className="mt-10 rounded-2xl border border-gray-100 bg-gradient-to-tr from-gray-50 to-white p-6 text-center shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
              <p className="text-base font-semibold text-gray-900">{cta.title}</p>
              <p className="mt-1 text-sm text-gray-500">{cta.body}</p>
              <Link href="/" className="mt-4 inline-block rounded-xl bg-gray-900 px-6 py-3 text-sm font-medium text-white hover:bg-gray-800">
                {cta.button}
              </Link>
            </div>
          </>
        )}

        <footer className="mt-10 text-center text-xs text-gray-400">
          Powered by MiroMind Deep Research · SignalHire
        </footer>
      </main>
    </div>
  );
}
