"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  formatOpsDate,
  formatOpsNumber,
  opsApiError,
  opsFailureReason,
  opsLedgerType,
} from "@/lib/ops-copy.mjs";

type Account = {
  user_id: string;
  email: string | null;
  available_credits: number;
  reserved_credits: number;
};

type LedgerEntry = {
  id: string;
  entry_type: string;
  amount: number;
  available_credits: number;
  reserved_credits: number;
  created_at: string;
};

type User = { id: string; email: string };

type FailedReservation = {
  reservation_id: string;
  user_id: string;
  email: string | null;
  run_id: string;
  task_id: string | null;
  status: "released";
  amount: number;
  updated_at: string;
  failure_reason: "monitor_run_failed" | "monitor_run_cancelled";
};

export default function OpsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState("");
  const [query, setQuery] = useState("");
  const [account, setAccount] = useState<Account | null>(null);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [grantMessage, setGrantMessage] = useState("");
  const [grantError, setGrantError] = useState("");
  const [failedReservations, setFailedReservations] = useState<FailedReservation[]>([]);
  const [failedReservationsError, setFailedReservationsError] = useState("");
  const [failedReservationsLoading, setFailedReservationsLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/ops/whoami", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        setAuthError(opsApiError(payload, "无法验证运营权限，请重新登录。"));
        return;
      }
      if (payload?.user?.id && payload?.user?.email) setUser(payload.user);
      else setAuthError("无法验证运营权限，请重新登录。");
    }).catch(() => {
      if (active) setAuthError("无法验证运营权限，请重新登录。");
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setFailedReservationsLoading(true);
    setFailedReservationsError("");
    fetch("/api/ops/credits/failed-reservations", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        setFailedReservationsError(opsApiError(payload, "无法加载近期失败的预留记录。"));
        return;
      }
      setFailedReservations(Array.isArray(payload?.reservations) ? payload.reservations : []);
    }).catch(() => {
      if (active) setFailedReservationsError("无法加载近期失败的预留记录。");
    }).finally(() => {
      if (active) setFailedReservationsLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  async function loadLedger(userId: string) {
    const response = await fetch(`/api/ops/credits/${encodeURIComponent(userId)}/ledger`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(opsApiError(payload, "无法加载 Credits 账本。"));
    setLedger(Array.isArray(payload?.ledger) ? payload.ledger : []);
  }

  async function lookup(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    setBusy(true); setLookupError(""); setGrantMessage(""); setGrantError("");
    try {
      const parameter = trimmed.includes("@") ? "email" : "user_id";
      const response = await fetch(`/api/ops/credits?${parameter}=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(opsApiError(payload, "无法查询 Credits 账户。"));
      const found = Array.isArray(payload?.accounts) ? payload.accounts[0] : null;
      if (!found?.user_id) {
        setAccount(null); setLedger([]); setLookupError("未找到与该标识对应的 Credits 账户记录。");
        return;
      }
      setAccount(found);
      await loadLedger(found.user_id);
    } catch (error) {
      setAccount(null); setLedger([]); setLookupError(error instanceof Error ? error.message : "无法查询 Credits 账户。");
    } finally {
      setBusy(false);
    }
  }

  async function grantCredits(event: FormEvent) {
    event.preventDefault();
    if (!account || busy) return;
    setBusy(true); setGrantMessage(""); setGrantError("");
    try {
      const parsedAmount = Number(amount);
      const response = await fetch("/api/ops/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: account.user_id, amount: parsedAmount, reason, idempotency_key: idempotencyKey }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(opsApiError(payload, "无法发放 Credits。"));
      const grant = payload?.grant;
      if (!grant || !Number.isInteger(grant.available_credits) || !Number.isInteger(grant.reserved_credits)) throw new Error("Credits 返回数据无效。");
      setAccount((current) => current ? { ...current, available_credits: grant.available_credits, reserved_credits: grant.reserved_credits } : current);
      setGrantMessage(grant.duplicate ? "该幂等键已处理过，本次没有重复增加余额。" : "Credits 已发放并记录到账本。");
      await loadLedger(account.user_id);
    } catch (error) {
      setGrantError(error instanceof Error ? error.message : "无法发放 Credits。");
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    const login = `/ops/login?next=${encodeURIComponent("/ops")}`;
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5"><section className="sh-surface w-full p-7"><h1 className="text-2xl font-semibold">需要运营权限</h1><p className="mt-3 text-sm text-[var(--sh-muted)]">{authError}</p><a className="sh-primary-action mt-6" href={login}>前往后台登录</a></section></main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-6">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sh-faint)]">SignalHire</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Credits 运营台</h1></div>
        <div className="flex flex-wrap items-center gap-3"><a className="sh-secondary-action" href="/ops/search-eval-review">复核 Search Eval</a><p className="text-sm text-[var(--sh-muted)]">{user ? user.email : "正在验证权限…"}</p></div>
      </header>

      <section className="sh-surface mt-7 p-5 md:p-6">
        <h2 className="text-lg font-semibold">查询 Credits 账户</h2>
        <p className="mt-1 text-sm text-[var(--sh-muted)]">使用已记录的邮箱或完整用户 ID 查询。本后台不会显示候选人、项目或报告数据。</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={lookup}>
          <input aria-label="账户邮箱或用户 ID" className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none focus:border-[var(--sh-blue)]" placeholder="user@example.com 或 UUID" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="sh-primary-action shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !user} type="submit">{busy ? "正在查询…" : "查询账户"}</button>
        </form>
        {lookupError ? <p role="alert" className="mt-3 text-sm text-red-700">{lookupError}</p> : null}
      </section>

      {account ? <div className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="sh-surface min-w-0 p-5 md:p-6">
          <p className="text-sm text-[var(--sh-muted)]">账户</p><p className="mt-1 break-all font-medium">{account.email ?? account.user_id}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-blue-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">可用</dt><dd className="mt-1 text-2xl font-semibold text-blue-950">{formatOpsNumber(account.available_credits)}</dd></div><div className="rounded-2xl bg-stone-100 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">已预留</dt><dd className="mt-1 text-2xl font-semibold text-stone-900">{formatOpsNumber(account.reserved_credits)}</dd></div></dl>
          <form className="mt-7 space-y-4 border-t border-black/10 pt-6" onSubmit={grantCredits}>
            <h2 className="text-lg font-semibold">发放 Credits</h2>
            <label className="block text-sm font-medium text-[var(--sh-muted)]">数量<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5" inputMode="numeric" min="1" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-[var(--sh-muted)]">原因<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-[var(--sh-muted)]">幂等键<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5" maxLength={200} value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} required /></label>
            <button className="sh-primary-action disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !amount || !reason.trim() || !idempotencyKey.trim()} type="submit">发放 Credits</button>
            {grantMessage ? <p className="text-sm text-emerald-700">{grantMessage}</p> : null}{grantError ? <p role="alert" className="text-sm text-red-700">{grantError}</p> : null}
          </form>
        </section>
        <div className="min-w-0 space-y-7">
          <section className="sh-surface p-5 md:p-6"><h2 className="text-lg font-semibold">Credits 账本</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[var(--sh-faint)]"><tr><th className="pb-3 pr-3">类型</th><th className="pb-3 pr-3">数量</th><th className="pb-3 pr-3">余额</th><th className="pb-3">记录时间</th></tr></thead><tbody>{ledger.map((entry) => <tr className="border-b border-black/5" key={entry.id}><td className="py-3 pr-3">{opsLedgerType(entry.entry_type)}</td><td className="py-3 pr-3">{formatOpsNumber(entry.amount)}</td><td className="py-3 pr-3">可用 {formatOpsNumber(entry.available_credits)}<br />已预留 {formatOpsNumber(entry.reserved_credits)}</td><td className="py-3 text-[var(--sh-muted)]">{formatOpsDate(entry.created_at)}</td></tr>)}</tbody></table>{ledger.length === 0 ? <p className="mt-4 text-sm text-[var(--sh-muted)]">暂无账本记录。</p> : null}</div></section>
          <section className="sh-surface p-5 md:p-6"><h2 className="text-lg font-semibold">近期失败的预留记录</h2><p className="mt-1 text-sm text-[var(--sh-muted)]">这里只显示已释放的 Credits 预留记录。失败原因是有限状态，不显示研究日志或请求数据。</p>{failedReservationsError ? <p className="mt-3 text-sm text-red-700" role="alert">{failedReservationsError}</p> : null}{failedReservationsLoading ? <p className="mt-3 text-sm text-[var(--sh-muted)]">正在加载失败记录…</p> : null}{!failedReservationsLoading && !failedReservationsError && failedReservations.length === 0 ? <p className="mt-3 text-sm text-[var(--sh-muted)]">暂无已释放的预留记录。</p> : null}{failedReservations.length > 0 ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[var(--sh-faint)]"><tr><th className="pb-3 pr-3">用户</th><th className="pb-3 pr-3">运行 / 任务</th><th className="pb-3 pr-3">Credits</th><th className="pb-3 pr-3">原因</th><th className="pb-3">释放时间</th></tr></thead><tbody>{failedReservations.map((reservation) => <tr className="border-b border-black/5" key={reservation.reservation_id}><td className="py-3 pr-3"><span className="block break-all">{reservation.email ?? reservation.user_id}</span></td><td className="py-3 pr-3 font-mono text-xs"><span className="block">{reservation.run_id}</span>{reservation.task_id ? <span className="mt-1 block text-[var(--sh-muted)]">任务 {reservation.task_id}</span> : null}</td><td className="py-3 pr-3">{formatOpsNumber(reservation.amount)}</td><td className="py-3 pr-3">{opsFailureReason(reservation.failure_reason)}</td><td className="py-3 text-[var(--sh-muted)]">{formatOpsDate(reservation.updated_at)}</td></tr>)}</tbody></table></div> : null}</section>
        </div>
      </div> : null}
    </main>
  );
}
