// components/result.tsx —— 候选人/验证结果的展示组件 (纯展示, 无 hooks)。
// 同时被 app/page.tsx (客户端工具) 和 app/r/[id]/page.tsx (服务端可分享报告) 复用。

export type Verdict = "verified" | "contradicted" | "unverified";
export type Evidence = { note: string; url: string };
export type Claim = { claim: string; verdict: Verdict; evidence: Evidence[] };
export type Candidate = {
  name: string;
  headline: string;
  links: { github?: string | null; linkedin?: string | null; other?: string | null };
  claims: Claim[];
  summary: string;
};
export type VerifyReport = {
  candidate_name: string;
  overall_trust: "high" | "medium" | "low";
  claims: Claim[];
  red_flags: string[];
};

// 裁决语义色 (与 DESIGN-SYSTEM.md 一致)
const VERDICT: Record<Verdict, { label: string; icon: string; chip: string; bar: string }> = {
  verified: { label: "已验证", icon: "✓", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "border-l-emerald-400" },
  contradicted: { label: "矛盾", icon: "✕", chip: "bg-red-50 text-red-700 ring-red-200", bar: "border-l-red-400" },
  unverified: { label: "查无实据", icon: "?", chip: "bg-amber-50 text-amber-700 ring-amber-200", bar: "border-l-amber-400" },
};

function host(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "来源"; }
}
function favicon(url: string): string {
  try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`; } catch { return ""; }
}

export function VerdictBadge({ v }: { v: Verdict }) {
  const m = VERDICT[v] ?? VERDICT.unverified;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${m.chip}`}>
      <span className="font-bold">{m.icon}</span>
      {m.label}
    </span>
  );
}

export function Tally({ claims }: { claims: Claim[] }) {
  const counts = claims.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] ?? 0) + 1), a), {} as Record<Verdict, number>);
  const order: Verdict[] = ["verified", "unverified", "contradicted"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {order.filter((v) => counts[v]).map((v) => (
        <span key={v} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ${VERDICT[v].chip}`}>
          <span className="font-bold">{VERDICT[v].icon}</span>
          {counts[v]} {VERDICT[v].label}
        </span>
      ))}
    </div>
  );
}

export function ClaimBlock({ c }: { c: Claim }) {
  const m = VERDICT[c.verdict] ?? VERDICT.unverified;
  return (
    <div className={`rounded-xl border-l-2 bg-gray-50/70 p-3.5 ${m.bar}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed text-gray-900">{c.claim}</p>
        <VerdictBadge v={c.verdict} />
      </div>
      {c.evidence?.length > 0 && (
        <ul className="mt-2.5 space-y-1.5">
          {c.evidence.map((e, i) => (
            <li key={i} className="text-xs leading-relaxed text-gray-500">
              {e.note}
              {e.url && (
                <a
                  href={e.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-white px-1.5 py-0.5 align-middle font-medium text-blue-600 ring-1 ring-gray-200 hover:ring-blue-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={favicon(e.url)} alt="" width={12} height={12} className="rounded-sm" />
                  {host(e.url)} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function LinkPill({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200">
      {children}
    </a>
  );
}

export function CandidateCard({ c, delay = 0 }: { c: Candidate; delay?: number }) {
  return (
    <article
      style={{ animationDelay: `${delay}ms` }}
      className="sh-fade-in-up rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{c.name}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{c.headline}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {c.links?.github && <LinkPill href={c.links.github}>GitHub</LinkPill>}
          {c.links?.linkedin && <LinkPill href={c.links.linkedin}>LinkedIn</LinkPill>}
          {c.links?.other && <LinkPill href={c.links.other}>主页</LinkPill>}
        </div>
      </div>
      {c.claims?.length > 0 && <div className="mt-3"><Tally claims={c.claims} /></div>}
      <div className="mt-3 space-y-2.5">
        {c.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} />)}
      </div>
      <p className="mt-4 border-t border-gray-100 pt-3 text-sm italic text-gray-500">{c.summary}</p>
    </article>
  );
}

// 可信度环形大徽章
function TrustRing({ level }: { level: "high" | "medium" | "low" }) {
  const meta = {
    high: { label: "高", ring: "ring-emerald-200 text-emerald-700 bg-emerald-50", pct: 92, stroke: "#10b981" },
    medium: { label: "中", ring: "ring-amber-200 text-amber-700 bg-amber-50", pct: 58, stroke: "#f59e0b" },
    low: { label: "低", ring: "ring-red-200 text-red-700 bg-red-50", pct: 24, stroke: "#ef4444" },
  }[level] ?? { label: "低", ring: "ring-red-200 text-red-700 bg-red-50", pct: 24, stroke: "#ef4444" };
  const r = 26, circ = 2 * Math.PI * r;
  return (
    <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
      <svg className="absolute -rotate-90" width="80" height="80" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#eee" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={meta.stroke} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - meta.pct / 100)} />
      </svg>
      <div className="text-center">
        <div className="text-[9px] font-medium uppercase tracking-wide text-gray-400">可信度</div>
        <div className={`text-xl font-bold leading-none ${level === "high" ? "text-emerald-600" : level === "medium" ? "text-amber-600" : "text-red-600"}`}>{meta.label}</div>
      </div>
    </div>
  );
}

export function TrustReportView({ r }: { r: VerifyReport }) {
  return (
    <article className="sh-fade-in-up rounded-2xl border border-gray-100 bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{r.candidate_name}</h3>
          {r.claims?.length > 0 && <div className="mt-2"><Tally claims={r.claims} /></div>}
        </div>
        <TrustRing level={r.overall_trust} />
      </div>
      <div className="mt-4 space-y-2.5">
        {r.claims?.map((cl, i) => <ClaimBlock key={i} c={cl} />)}
      </div>
      {r.red_flags?.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50/60 p-4">
          <p className="text-sm font-semibold text-red-700">🚩 红旗</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-red-600/90">
            {r.red_flags.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}
    </article>
  );
}
