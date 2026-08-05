"use client";

import { useSyncExternalStore, useState } from "react";
import { login } from "@/lib/auth";
import { normalizeOpsNext } from "@/lib/ops-navigation.mjs";

function requestedNext() {
  if (typeof window === "undefined") return "/ops";
  return normalizeOpsNext(new URLSearchParams(window.location.search).get("next"));
}

export default function OpsLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const next = useSyncExternalStore(() => () => {}, requestedNext, () => "/ops");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setError("");
    const result = await login(email.trim(), password, "zh");
    if (result.ok) {
      window.location.assign(next);
      return;
    }
    setError(result.needVerify ? "请先完成邮箱验证，再登录管理后台。" : "登录失败，请检查邮箱和密码后重试。");
    setSubmitting(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
      <section className="sh-surface w-full p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sh-faint)]">SignalHire</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">管理后台</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">请使用官方运营账号登录。每个后台接口都会再次校验访问权限。</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-[var(--sh-muted)]">
            邮箱
            <input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-[var(--sh-muted)]">
            密码
            <input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={submitting} className="sh-primary-action w-full disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "正在登录…" : "登录"}</button>
        </form>
        <p className="mt-5 text-xs leading-5 text-[var(--sh-faint)]">管理后台使用仅限当前域名的独立会话。主站的登录状态不会自动获得后台权限。</p>
      </section>
    </main>
  );
}
