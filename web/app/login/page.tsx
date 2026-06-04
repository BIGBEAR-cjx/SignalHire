"use client";

import { useState } from "react";
import Link from "next/link";
import { FiArrowRight, FiLock, FiMail } from "react-icons/fi";
import { login } from "@/lib/auth";
import { LogoMark } from "@/components/ui/signal-ui";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !pw) return;
    setLoading(true); setErr("");
    const r = await login(email.trim(), pw);
    if (r.ok) {
      const next = new URLSearchParams(location.search).get("next") || "/";
      location.href = next; // 整页跳转, 让页面和服务端请求读取新 cookie
    } else {
      setErr(r.error);
      setLoading(false);
    }
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--sh-faint)]">AI Talent Intelligence</p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--sh-ink)] md:text-6xl">
              回到你的 AI 人才搜索工作台。
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--sh-muted)]">
              继续管理招聘项目、候选池和多源证据核验，让 shortlist 从搜索到交付保持同一套可信链路。
            </p>
          </div>
        </section>

        <section className="sh-surface mx-auto w-full max-w-md p-6 md:p-7">
          <div className="mb-7">
            <p className="text-sm font-medium text-[var(--sh-muted)]">账户登录</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--sh-ink)]">登录 SignalHire</h2>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">邮箱</span>
              <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                <FiMail className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com" autoComplete="email"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-[var(--sh-muted)]">密码</span>
              <span className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/78 px-4 py-3 transition focus-within:border-[var(--sh-blue)] focus-within:bg-white">
                <FiLock className="h-4 w-4 text-[var(--sh-faint)]" aria-hidden="true" />
                <input
                  type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                  placeholder="输入密码" autoComplete="current-password"
                  className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--sh-ink)] outline-none placeholder:text-[var(--sh-faint)]"
                />
              </span>
            </label>
            {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">{err}</p>}
            <button type="submit" disabled={loading} className="sh-primary-action w-full disabled:pointer-events-none disabled:opacity-50">
              {loading ? "登录中…" : "登录"}
              <FiArrowRight aria-hidden="true" />
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--sh-muted)]">
            还没有账号？<Link href="/register" className="font-semibold text-[var(--sh-blue)] hover:underline">注册</Link>
          </p>
        </section>
      </div>
    </main>
  );
}
