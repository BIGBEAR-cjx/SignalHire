"use client";

import { useState } from "react";
import Link from "next/link";
import { register, verify } from "@/lib/auth";

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <LogoMark className="h-10 w-10" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">注册 SignalHire</h1>
          <p className="text-sm text-gray-500">逐条核实的 AI 猎头</p>
        </div>

        {stage === "form" ? (
          <form onSubmit={submit} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <input
              value={name} onChange={(e) => setName(e.target.value)} placeholder="姓名（可选）" autoComplete="name"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
            />
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" autoComplete="email"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
            />
            <input
              type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="密码（至少 6 位）" autoComplete="new-password"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
            />
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50">
              {loading ? "注册中…" : "注册"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
            <p className="text-sm text-gray-600">验证码已发送到 <span className="font-medium text-gray-900">{email}</span>，请输入：</p>
            <input
              value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6 位验证码" inputMode="numeric"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg tracking-widest text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:bg-white"
            />
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
            <button type="submit" disabled={loading} className="w-full rounded-xl bg-gray-900 px-5 py-3 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50">
              {loading ? "验证中…" : "验证并登录"}
            </button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-gray-500">
          已有账号？<Link href="/login" className="font-medium text-gray-900 hover:underline">登录</Link>
        </p>
      </div>
    </main>
  );
}
