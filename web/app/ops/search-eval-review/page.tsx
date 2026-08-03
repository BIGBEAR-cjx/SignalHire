"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Verdict = "" | "pass" | "revise" | "uncertain";
type ReviewCase = {
  id: string;
  difficulty: string;
  brief: string;
  requiredConditions: string[];
  excludedConditions: string[];
  candidate: { name: string; canonicalUrl: string };
  evidenceUrls: string[];
};
type Entry = { case_id: string; verdict: Exclude<Verdict, "">; notes: string };
type Review = {
  id: string;
  reviewer_name: string;
  submitted_by_email: string;
  submitted_at: string;
  fixture_version: string;
  entries: Entry[];
  summary: { total: number; reviewed: number; pass: number; revise: number; uncertain: number; complete: boolean; allPass: boolean };
  promotion: { confirmed_by_email: string; confirmed_at: string } | null;
};

function apiError(payload: unknown, fallback: string) {
  return payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : fallback;
}

function entryMap(entries: Entry[]) {
  return Object.fromEntries(entries.map((entry) => [entry.case_id, { verdict: entry.verdict as Verdict, notes: entry.notes }]));
}

export default function SearchEvalReviewPage() {
  const [cases, setCases] = useState<ReviewCase[]>([]);
  const [fixtureVersion, setFixtureVersion] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [entries, setEntries] = useState<Record<string, { verdict: Verdict; notes: string }>>({});
  const [latestReview, setLatestReview] = useState<Review | null>(null);
  const [authError, setAuthError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ownerAttestation, setOwnerAttestation] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/ops/search-eval-review", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json().catch(() => null);
      if (!active) return;
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setAuthError(apiError(payload, "Unable to verify operations access."));
        else setLoadError(apiError(payload, "Unable to load the review fixture."));
        return;
      }
      const loadedCases = Array.isArray(payload?.cases) ? payload.cases : [];
      if (!loadedCases.length || typeof payload?.fixture_version !== "string") {
        setLoadError("The review fixture is incomplete.");
        return;
      }
      const review = payload?.latest_review && typeof payload.latest_review === "object" ? payload.latest_review as Review : null;
      setCases(loadedCases); setFixtureVersion(payload.fixture_version); setLatestReview(review);
      if (review) {
        setReviewerName(review.reviewer_name ?? "");
        setEntries(entryMap(Array.isArray(review.entries) ? review.entries : []));
      }
    }).catch(() => {
      if (active) setLoadError("Unable to load the review fixture.");
    });
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const verdicts = Object.values(entries).map((entry) => entry.verdict).filter(Boolean) as Exclude<Verdict, "">[];
    return {
      reviewed: verdicts.length,
      pass: verdicts.filter((verdict) => verdict === "pass").length,
      revise: verdicts.filter((verdict) => verdict === "revise").length,
      uncertain: verdicts.filter((verdict) => verdict === "uncertain").length,
      complete: cases.length > 0 && verdicts.length === cases.length,
    };
  }, [cases.length, entries]);

  function changeEntry(caseId: string, change: Partial<{ verdict: Verdict; notes: string }>) {
    setEntries((current) => ({ ...current, [caseId]: { verdict: current[caseId]?.verdict ?? "", notes: current[caseId]?.notes ?? "", ...change } }));
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (busy || !summary.complete) return;
    setBusy(true); setSubmitError(""); setMessage("");
    try {
      const payload = {
        reviewer_name: reviewerName,
        fixture_version: fixtureVersion,
        entries: cases.map((item) => ({ case_id: item.id, verdict: entries[item.id]?.verdict ?? "", notes: entries[item.id]?.notes ?? "" })),
      };
      const response = await fetch("/api/ops/search-eval-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.review) throw new Error(apiError(result, "Unable to store the independent review."));
      setLatestReview(result.review); setMessage("Independent review snapshot recorded. The fixture remains a draft until source-control promotion.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to store the independent review.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPromotion() {
    if (!latestReview || !latestReview.summary.allPass || !ownerAttestation || busy) return;
    setBusy(true); setSubmitError(""); setMessage("");
    try {
      const response = await fetch("/api/ops/search-eval-review/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ review_id: latestReview.id }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(apiError(result, "Unable to record the product-owner confirmation."));
      setLatestReview((current) => current ? { ...current, promotion: { confirmed_by_email: "Recorded", confirmed_at: new Date().toISOString() } } : current);
      setMessage("Product-owner confirmation recorded. A source-controlled fixture change is still required before the golden set can be promoted.");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to record the product-owner confirmation.");
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    const login = `/ops/login?next=${encodeURIComponent("/ops/search-eval-review")}`;
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5"><section className="sh-surface w-full p-7"><h1 className="text-2xl font-semibold">Operations access required</h1><p className="mt-3 text-sm text-[var(--sh-muted)]">{authError}</p><a className="sh-primary-action mt-6" href={login}>Go to ops sign in</a></section></main>;
  }

  return <main className="mx-auto max-w-5xl px-5 py-8 md:py-12">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-6">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sh-faint)]">SignalHire</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Search Eval independent review</h1></div>
      <a className="sh-secondary-action" href="/ops">Back to Credits operations</a>
    </header>

    <section className="sh-surface mt-7 p-5 md:p-6">
      <h2 className="text-lg font-semibold">Review boundary</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">Open the identity page and evidence for every candidate yourself. A recorded review is an auditable snapshot, not a direct change to the Search Eval fixture. Only an all-pass review plus product-owner confirmation can be prepared for source-controlled promotion.</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-blue-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">Reviewed</dt><dd className="mt-1 text-2xl font-semibold text-blue-950">{summary.reviewed}/{cases.length || "–"}</dd></div><div className="rounded-2xl bg-emerald-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Pass</dt><dd className="mt-1 text-2xl font-semibold text-emerald-950">{summary.pass}</dd></div><div className="rounded-2xl bg-amber-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-amber-700">Revise</dt><dd className="mt-1 text-2xl font-semibold text-amber-950">{summary.revise}</dd></div><div className="rounded-2xl bg-stone-100 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">Uncertain</dt><dd className="mt-1 text-2xl font-semibold text-stone-900">{summary.uncertain}</dd></div></dl>
    </section>

    {loadError ? <p className="mt-5 text-sm text-red-700" role="alert">{loadError}</p> : null}
    {latestReview ? <section className="mt-7 border-y border-black/10 py-5 text-sm"><p><span className="font-semibold">Latest saved review:</span> {latestReview.reviewer_name}, {latestReview.submitted_at ? new Date(latestReview.submitted_at).toLocaleString() : "time unavailable"}.</p><p className="mt-1 text-[var(--sh-muted)]">{latestReview.promotion ? "Product-owner confirmation has been recorded. The fixture is still a source-controlled draft." : "No product-owner confirmation has been recorded for this snapshot."}</p></section> : null}

    <form className="mt-7 space-y-7" onSubmit={submitReview}>
      <section className="sh-surface p-5 md:p-6"><label className="block max-w-xl text-sm font-medium text-[var(--sh-muted)]">Independent reviewer name<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]" maxLength={120} onChange={(event) => setReviewerName(event.target.value)} placeholder="Name of the person who independently opened the evidence" required value={reviewerName} /></label><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">The signed-in operations account records this submission. Enter the separate reviewer’s name here only after they have completed the review.</p></section>

      {cases.map((item, index) => {
        const value = entries[item.id] ?? { verdict: "" as Verdict, notes: "" };
        return <section className="sh-surface p-5 md:p-6" key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-[var(--sh-muted)]">{item.difficulty} · {index + 1} of {cases.length}</p><h2 className="mt-1 text-xl font-semibold">{item.candidate.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{item.brief}</p></div><a className="sh-secondary-action" href={item.candidate.canonicalUrl} rel="noreferrer" target="_blank">Open identity</a></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><h3 className="text-sm font-semibold">Required conditions</h3><ul className="mt-2 space-y-1 text-sm text-[var(--sh-muted)]">{item.requiredConditions.map((condition) => <li key={condition}>• {condition}</li>)}</ul></div><div><h3 className="text-sm font-semibold">Exclude if</h3><ul className="mt-2 space-y-1 text-sm text-[var(--sh-muted)]">{item.excludedConditions.map((condition) => <li key={condition}>• {condition}</li>)}</ul></div></div>
          <div className="mt-5"><h3 className="text-sm font-semibold">Evidence to verify</h3><ul className="mt-2 space-y-1 text-sm">{item.evidenceUrls.map((url) => <li className="break-all" key={url}><a className="text-[var(--sh-blue)] underline decoration-black/20 underline-offset-2" href={url} rel="noreferrer" target="_blank">{url}</a></li>)}</ul></div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"><label className="block text-sm font-medium text-[var(--sh-muted)]">Independent conclusion<select aria-label={`Conclusion for ${item.candidate.name}`} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)]" onChange={(event) => changeEntry(item.id, { verdict: event.target.value as Verdict })} required value={value.verdict}><option value="">Select conclusion</option><option value="pass">Pass</option><option value="revise">Revise</option><option value="uncertain">Uncertain</option></select></label><label className="block text-sm font-medium text-[var(--sh-muted)]">Review note{value.verdict === "revise" || value.verdict === "uncertain" ? " (required)" : " (optional)"}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)]" maxLength={2000} onChange={(event) => changeEntry(item.id, { notes: event.target.value })} required={value.verdict === "revise" || value.verdict === "uncertain"} value={value.notes} /></label></div>
        </section>;
      })}

      <section className="sh-surface p-5 md:p-6"><h2 className="text-lg font-semibold">Store review snapshot</h2><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">Submitting stores a new immutable review snapshot. It does not change the root fixture review status.</p><button className="sh-primary-action mt-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !summary.complete || reviewerName.trim().length < 2} type="submit">{busy ? "Saving…" : "Submit independent review"}</button>{!summary.complete ? <p className="mt-3 text-sm text-amber-800">Record a conclusion for all {cases.length} cases before submitting.</p> : null}{message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}{submitError ? <p className="mt-3 text-sm text-red-700" role="alert">{submitError}</p> : null}</section>
    </form>

    {latestReview?.summary.allPass && !latestReview.promotion ? <section className="sh-surface mt-7 p-5 md:p-6"><h2 className="text-lg font-semibold">Product-owner confirmation</h2><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">All 30 cases passed in the saved snapshot. Confirm only after verifying that the named reviewer did not participate in the automatic public-evidence review.</p><label className="mt-4 flex items-start gap-3 text-sm leading-6 text-[var(--sh-muted)]"><input checked={ownerAttestation} className="mt-1" onChange={(event) => setOwnerAttestation(event.target.checked)} type="checkbox" />I confirm the saved review is independent and may enter source-controlled promotion review.</label><button className="sh-primary-action mt-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !ownerAttestation} onClick={confirmPromotion} type="button">Record product-owner confirmation</button></section> : null}
  </main>;
}
