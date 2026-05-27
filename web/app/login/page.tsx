"use client";

import { useState } from "react";
import Link from "next/link";
import { login } from "@/lib/auth";

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <LogoMark className="h-10 w-10" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">登录 SignalHire</h1>
          <p className="text-sm text-gray-500">逐条核实的 AI 猎头</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱" autoComplete="email"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
          <input
            type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            placeholder="密码" autoComplete="current-password"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
          />
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <button type="submit" disabled={loading} className="w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50">
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
        <p className="mt-5 text-center text-sm text-gray-500">
          还没有账号？<Link href="/register" className="font-medium text-gray-900 hover:underline">注册</Link>
        </p>
      </div>
    </main>
  );
}
