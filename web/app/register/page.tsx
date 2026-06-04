"use client";

import { useState } from "react";
import Link from "next/link";
import { FiArrowRight, FiLock, FiMail, FiShield, FiUser } from "react-icons/fi";
import { register, verify } from "@/lib/auth";
import { LogoMark } from "@/components/ui/signal-ui";

function go() {
  const next = new URLSearchParams(location.search).get("next") || "/";
  location.href = next;
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"form" | "verify">("form");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || pw.length < 6) { setErr("请填写邮箱，密码至少 6 位"); return; }
    setLoading(true); setErr("");
    const r = await register(email.trim(), pw, name.trim() || undefined);
    setLoading(false);
    if (r.ok) return go();
    if (r.needVerify) { setStage("verify"); setErr(""); return; }
    setErr(r.error);
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp.trim()) return;
    setLoading(true); setErr("");
    const r = await verify(email.trim(), otp.trim());
    setLoading(false);
    if (r.ok) return go();
    setErr(r.error);
  }

  return (
    <main className="min-h-screen px-5 py-6 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-6xl flex-col justify-center gap-8 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <section className="space-y-8">
          <Link href="/" className="inline-flex items-center gap-2 text-[15px] font-semibold text-[var(--sh-ink)]">
            <LogoMark className="h-8 w-8" />
            SignalHire
          </Link>
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sh-faint)]">Build Your Talent Graph</p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--sh-ink)] md:text-6xl">
              为 AI 招聘建立可信搜索入口。
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--sh-muted)]">
              创建账户后即可沉淀项目画像、候选人证据和每轮反馈，让平台持续优化同一搜索任务。
            </p>
          </div>
        </section>

        <section className="sh-surface mx-auto w-full max-w-md p-6 md:p-7">
          <div className="mb-7">
            <p className="text-sm font-medium text-[var(--sh-muted)]">
              {stage === "form" ? "创建账户" : "邮箱验证"}
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">
              {stage === "form" ? "注册 SignalHire" : "验证邮箱"}
            </h2>
          </div>

        {stage === "form" ? (
          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">姓名</span>
              <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                <FiUser className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                <input
                  value={name} onChange={(e) => setName(e.target.value)} placeholder="可选" autoComplete="name"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">邮箱</span>
              <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                <FiMail className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">密码</span>
              <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                <FiLock className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                <input
                  type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="至少 6 位" autoComplete="new-password"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                />
              </span>
            </label>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{err}</p>}
            <button type="submit" disabled={loading} className="sh-primary-action w-full disabled:pointer-events-none disabled:opacity-50">
              {loading ? "注册中…" : "注册"}
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="rounded-3xl bg-white/70 px-4 py-3 text-sm leading-6 text-[var(--sh-muted)] ring-1 ring-black/10">
              验证码已发送到 <span className="font-semibold text-[var(--sh-ink)]">{email}</span>
            </p>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">验证码</span>
              <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                <FiShield className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                <input
                  value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6 位验证码" inputMode="numeric"
                  className="min-w-0 flex-1 bg-transparent text-center text-lg tracking-[0.35em] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                />
              </span>
            </label>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{err}</p>}
            <button type="submit" disabled={loading} className="sh-primary-action w-full disabled:pointer-events-none disabled:opacity-50">
              {loading ? "验证中…" : "验证并登录"}
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>
        )}

          <p className="mt-6 text-center text-sm text-[var(--sh-muted)]">
            已有账号？<Link href="/login" className="font-semibold text-[var(--sh-blue)] hover:underline">登录</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
