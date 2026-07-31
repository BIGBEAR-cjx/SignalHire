"use client";

import { FormEvent, useEffect, useState } from "react";

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

function apiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/ops/whoami", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        setAuthError(apiError(payload, "Unable to verify operations access."));
        return;
      }
      if (payload?.user?.id && payload?.user?.email) setUser(payload.user);
      else setAuthError("Unable to verify operations access.");
    }).catch(() => {
      if (active) setAuthError("Unable to verify operations access.");
    });
    return () => { active = false; };
  }, []);

  async function loadLedger(userId: string) {
    const response = await fetch(`/api/ops/credits/${encodeURIComponent(userId)}/ledger`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(apiError(payload, "Unable to load ledger."));
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
      if (!response.ok) throw new Error(apiError(payload, "Unable to look up account."));
      const found = Array.isArray(payload?.accounts) ? payload.accounts[0] : null;
      if (!found?.user_id) {
        setAccount(null); setLedger([]); setLookupError("No recorded Credits account found for this identifier.");
        return;
      }
      setAccount(found);
      await loadLedger(found.user_id);
    } catch (error) {
      setAccount(null); setLedger([]); setLookupError(error instanceof Error ? error.message : "Unable to look up account.");
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
      if (!response.ok) throw new Error(apiError(payload, "Unable to add Credits."));
      const grant = payload?.grant;
      if (!grant || !Number.isInteger(grant.available_credits) || !Number.isInteger(grant.reserved_credits)) throw new Error("Invalid Credits response.");
      setAccount((current) => current ? { ...current, available_credits: grant.available_credits, reserved_credits: grant.reserved_credits } : current);
      setGrantMessage(grant.duplicate ? "This idempotency key was already recorded; balance was not added again." : "Credits added and recorded.");
      await loadLedger(account.user_id);
    } catch (error) {
      setGrantError(error instanceof Error ? error.message : "Unable to add Credits.");
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    const login = `/ops/login?next=${encodeURIComponent("/ops")}`;
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5"><section className="sh-surface w-full p-7"><h1 className="text-2xl font-semibold">Operations access required</h1><p className="mt-3 text-sm text-[var(--sh-muted)]">{authError}</p><a className="sh-primary-action mt-6" href={login}>Go to ops sign in</a></section></main>;
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 md:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-6">
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sh-faint)]">SignalHire</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Credits operations</h1></div>
        <p className="text-sm text-[var(--sh-muted)]">{user ? user.email : "Verifying access…"}</p>
      </header>

      <section className="sh-surface mt-7 p-5 md:p-6">
        <h2 className="text-lg font-semibold">Find a Credits account</h2>
        <p className="mt-1 text-sm text-[var(--sh-muted)]">Search by a recorded email or exact user ID. This console does not expose candidate, project, or report data.</p>
        <form className="mt-4 flex flex-col gap-3 sm:flex-row" onSubmit={lookup}>
          <input aria-label="Account email or user ID" className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3 py-2.5 outline-none focus:border-[var(--sh-blue)]" placeholder="user@example.com or UUID" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="sh-primary-action shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !user} type="submit">{busy ? "Loading…" : "Find account"}</button>
        </form>
        {lookupError ? <p role="alert" className="mt-3 text-sm text-red-700">{lookupError}</p> : null}
      </section>

      {account ? <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <section className="sh-surface p-5 md:p-6">
          <p className="text-sm text-[var(--sh-muted)]">Account</p><p className="mt-1 break-all font-medium">{account.email ?? account.user_id}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-blue-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">Available</dt><dd className="mt-1 text-2xl font-semibold text-blue-950">{account.available_credits}</dd></div><div className="rounded-2xl bg-stone-100 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">Reserved</dt><dd className="mt-1 text-2xl font-semibold text-stone-900">{account.reserved_credits}</dd></div></dl>
          <form className="mt-7 space-y-4 border-t border-black/10 pt-6" onSubmit={grantCredits}>
            <h2 className="text-lg font-semibold">Add Credits</h2>
            <label className="block text-sm font-medium text-[var(--sh-muted)]">Amount<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5" inputMode="numeric" min="1" step="1" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-[var(--sh-muted)]">Reason<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} required /></label>
            <label className="block text-sm font-medium text-[var(--sh-muted)]">Idempotency key<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5" maxLength={200} value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} required /></label>
            <button className="sh-primary-action disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !amount || !reason.trim() || !idempotencyKey.trim()} type="submit">Add Credits</button>
            {grantMessage ? <p className="text-sm text-emerald-700">{grantMessage}</p> : null}{grantError ? <p role="alert" className="text-sm text-red-700">{grantError}</p> : null}
          </form>
        </section>
        <div className="space-y-7">
          <section className="sh-surface p-5 md:p-6"><h2 className="text-lg font-semibold">Ledger</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[460px] text-left text-sm"><thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[var(--sh-faint)]"><tr><th className="pb-3 pr-3">Type</th><th className="pb-3 pr-3">Amount</th><th className="pb-3 pr-3">Balance</th><th className="pb-3">Recorded</th></tr></thead><tbody>{ledger.map((entry) => <tr className="border-b border-black/5" key={entry.id}><td className="py-3 pr-3">{entry.entry_type}</td><td className="py-3 pr-3">{entry.amount}</td><td className="py-3 pr-3">{entry.available_credits} available<br />{entry.reserved_credits} reserved</td><td className="py-3 text-[var(--sh-muted)]">{new Date(entry.created_at).toLocaleString()}</td></tr>)}</tbody></table>{ledger.length === 0 ? <p className="mt-4 text-sm text-[var(--sh-muted)]">No ledger entries recorded.</p> : null}</div></section>
          <section className="rounded-3xl border border-dashed border-black/15 bg-white/45 p-5"><h2 className="text-lg font-semibold">Failed reservations</h2><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">Not available yet. The current ops API deliberately exposes only account balances and immutable ledger summaries; it does not infer failures from research data.</p></section>
        </div>
      </div> : null}
    </main>
  );
}
