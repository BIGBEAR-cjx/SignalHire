"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  formatOpsDate,
  formatOpsNumber,
  localizeSearchEvalCase,
  opsApiError,
  opsVerdict,
} from "@/lib/ops-copy.mjs";

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
        if (response.status === 401 || response.status === 403) setAuthError(opsApiError(payload, "无法验证运营权限，请重新登录。"));
        else setLoadError(opsApiError(payload, "无法加载 Search Eval 复核数据。"));
        return;
      }
      let loadedCases: ReviewCase[] = [];
      try {
        loadedCases = Array.isArray(payload?.cases) ? payload.cases.map(localizeSearchEvalCase) : [];
      } catch {
        setLoadError("复核案例的中文说明不完整，已停止加载，请联系管理员补充翻译。");
        return;
      }
      if (!loadedCases.length || typeof payload?.fixture_version !== "string") {
        setLoadError("Search Eval 复核数据不完整。");
        return;
      }
      const review = payload?.latest_review && typeof payload.latest_review === "object" ? payload.latest_review as Review : null;
      setCases(loadedCases); setFixtureVersion(payload.fixture_version); setLatestReview(review);
      if (review) {
        setReviewerName(review.reviewer_name ?? "");
        setEntries(entryMap(Array.isArray(review.entries) ? review.entries : []));
      }
    }).catch(() => {
      if (active) setLoadError("无法加载 Search Eval 复核数据。");
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
      if (!response.ok || !result?.review) throw new Error(opsApiError(result, "无法保存独立复核记录。"));
      setLatestReview(result.review); setMessage("独立复核快照已保存。在通过代码变更升级前，评测数据仍保持草稿状态。");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "无法保存独立复核记录。");
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
      if (!response.ok) throw new Error(opsApiError(result, "无法记录产品负责人确认。"));
      setLatestReview((current) => current ? { ...current, promotion: { confirmed_by_email: "已记录", confirmed_at: new Date().toISOString() } } : current);
      setMessage("产品负责人确认已记录。正式升级为黄金集前，仍需通过代码变更更新评测数据。");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "无法记录产品负责人确认。");
    } finally {
      setBusy(false);
    }
  }

  if (authError) {
    const login = `/ops/login?next=${encodeURIComponent("/ops/search-eval-review")}`;
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-5"><section className="sh-surface w-full p-7"><h1 className="text-2xl font-semibold">需要运营权限</h1><p className="mt-3 text-sm text-[var(--sh-muted)]">{authError}</p><a className="sh-primary-action mt-6" href={login}>前往后台登录</a></section></main>;
  }

  return <main className="mx-auto max-w-5xl px-5 py-8 md:py-12">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-6">
      <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--sh-faint)]">SignalHire</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Search Eval 独立复核</h1></div>
      <a className="sh-secondary-action" href="/ops">返回 Credits 运营台</a>
    </header>

    <section className="sh-surface mt-7 p-5 md:p-6">
      <h2 className="text-lg font-semibold">复核边界</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">请独立打开每位候选人的身份页和证据链接进行核验。保存的复核记录是一份可审计快照，不会直接修改 Search Eval 评测数据。只有全部通过并由产品负责人确认后，才可准备通过代码变更升级。</p>
      <dl className="mt-5 grid gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-blue-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-blue-700">已复核</dt><dd className="mt-1 text-2xl font-semibold text-blue-950">{formatOpsNumber(summary.reviewed)}/{cases.length ? formatOpsNumber(cases.length) : "–"}</dd></div><div className="rounded-2xl bg-emerald-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-emerald-700">通过</dt><dd className="mt-1 text-2xl font-semibold text-emerald-950">{formatOpsNumber(summary.pass)}</dd></div><div className="rounded-2xl bg-amber-50 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-amber-700">需修订</dt><dd className="mt-1 text-2xl font-semibold text-amber-950">{formatOpsNumber(summary.revise)}</dd></div><div className="rounded-2xl bg-stone-100 p-4"><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">不确定</dt><dd className="mt-1 text-2xl font-semibold text-stone-900">{formatOpsNumber(summary.uncertain)}</dd></div></dl>
    </section>

    {loadError ? <p className="mt-5 text-sm text-red-700" role="alert">{loadError}</p> : null}
    {latestReview ? <section className="mt-7 border-y border-black/10 py-5 text-sm"><p><span className="font-semibold">最近保存的复核：</span> {latestReview.reviewer_name}，{formatOpsDate(latestReview.submitted_at)}。</p><p className="mt-1 text-[var(--sh-muted)]">{latestReview.promotion ? "产品负责人已确认。评测数据目前仍是由代码管理的草稿。" : "该快照尚未记录产品负责人确认。"}</p></section> : null}

    <form className="mt-7 space-y-7" onSubmit={submitReview}>
      <section className="sh-surface p-5 md:p-6"><label className="block max-w-xl text-sm font-medium text-[var(--sh-muted)]">独立复核人姓名<input className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)] outline-none focus:border-[var(--sh-blue)]" maxLength={120} onChange={(event) => setReviewerName(event.target.value)} placeholder="填写已独立打开并核验证据的复核人姓名" required value={reviewerName} /></label><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">本次提交会记录当前登录的运营账号。请在独立复核人完成全部核验后，再填写其姓名。</p></section>

      {cases.map((item, index) => {
        const value = entries[item.id] ?? { verdict: "" as Verdict, notes: "" };
        return <section className="sh-surface p-5 md:p-6" key={item.id}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-medium text-[var(--sh-muted)]">{item.difficulty} · 第 {formatOpsNumber(index + 1)} 条，共 {formatOpsNumber(cases.length)} 条</p><h2 className="mt-1 text-xl font-semibold">{item.candidate.name}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--sh-muted)]">{item.brief}</p></div><a className="sh-secondary-action" href={item.candidate.canonicalUrl} rel="noreferrer" target="_blank">打开身份页</a></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2"><div><h3 className="text-sm font-semibold">必备条件</h3><ul className="mt-2 space-y-1 text-sm text-[var(--sh-muted)]">{item.requiredConditions.map((condition) => <li key={condition}>• {condition}</li>)}</ul></div><div><h3 className="text-sm font-semibold">排除条件</h3><ul className="mt-2 space-y-1 text-sm text-[var(--sh-muted)]">{item.excludedConditions.map((condition) => <li key={condition}>• {condition}</li>)}</ul></div></div>
          <div className="mt-5"><h3 className="text-sm font-semibold">待核验证据</h3><ul className="mt-2 space-y-1 text-sm">{item.evidenceUrls.map((url) => <li className="break-all" key={url}><a className="text-[var(--sh-blue)] underline decoration-black/20 underline-offset-2" href={url} rel="noreferrer" target="_blank">{url}</a></li>)}</ul></div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]"><label className="block text-sm font-medium text-[var(--sh-muted)]">独立复核结论<select aria-label={`${item.candidate.name} 的复核结论`} className="mt-2 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)]" onChange={(event) => changeEntry(item.id, { verdict: event.target.value as Verdict })} required value={value.verdict}><option value="">请选择结论</option><option value="pass">{opsVerdict("pass")}</option><option value="revise">{opsVerdict("revise")}</option><option value="uncertain">{opsVerdict("uncertain")}</option></select></label><label className="block text-sm font-medium text-[var(--sh-muted)]">复核备注{value.verdict === "revise" || value.verdict === "uncertain" ? "（必填）" : "（选填）"}<textarea className="mt-2 min-h-24 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-[var(--sh-ink)]" maxLength={2000} onChange={(event) => changeEntry(item.id, { notes: event.target.value })} required={value.verdict === "revise" || value.verdict === "uncertain"} value={value.notes} /></label></div>
        </section>;
      })}

      <section className="sh-surface p-5 md:p-6"><h2 className="text-lg font-semibold">保存复核快照</h2><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">提交后会保存一份新的不可变复核快照，不会修改评测数据根节点的审核状态。</p><button className="sh-primary-action mt-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !summary.complete || reviewerName.trim().length < 2} type="submit">{busy ? "正在保存…" : "提交独立复核"}</button>{!summary.complete ? <p className="mt-3 text-sm text-amber-800">请先为全部 {formatOpsNumber(cases.length)} 条案例记录结论，再提交。</p> : null}{message ? <p className="mt-3 text-sm text-emerald-700">{message}</p> : null}{submitError ? <p className="mt-3 text-sm text-red-700" role="alert">{submitError}</p> : null}</section>
    </form>

    {latestReview?.summary.allPass && !latestReview.promotion ? <section className="sh-surface mt-7 p-5 md:p-6"><h2 className="text-lg font-semibold">产品负责人确认</h2><p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">已保存快照中的全部 {formatOpsNumber(latestReview.summary.total)} 条案例均通过。请确认具名复核人未参与自动公开证据审核后，再进行确认。</p><label className="mt-4 flex items-start gap-3 text-sm leading-6 text-[var(--sh-muted)]"><input checked={ownerAttestation} className="mt-1" onChange={(event) => setOwnerAttestation(event.target.checked)} type="checkbox" />我确认已保存的复核是独立完成的，可以进入由代码管理的升级审核。</label><button className="sh-primary-action mt-5 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy || !ownerAttestation} onClick={confirmPromotion} type="button">记录产品负责人确认</button></section> : null}
  </main>;
}
