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
    const result = await login(email.trim(), password, "en");
    if (result.ok) {
      window.location.assign(next);
      return;
    }
    setError(result.error);
    setSubmitting(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
      <section className="sh-surface w-full p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sh-faint)]">SignalHire</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Operations console</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--sh-muted)]">Sign in with the official operations account. Access is checked again by every ops API.</p>
        <form className="mt-7 space-y-4" onSubmit={submit}>
          <label className="block text-sm font-medium text-[var(--sh-muted)]">
            Email
            <input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="block text-sm font-medium text-[var(--sh-muted)]">
            Password
            <input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <button type="submit" disabled={submitting} className="sh-primary-action w-full disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-xs leading-5 text-[var(--sh-faint)]">This host uses its own host-only session cookie. A main-site session does not grant operations access.</p>
      </section>
    </main>
  );
}
