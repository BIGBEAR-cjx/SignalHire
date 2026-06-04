# Apple Inspired UI Redesign Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production slice of the Apple-inspired SignalHire redesign: global visual tokens, reusable UI primitives, redesigned console chrome, redesigned public hero, and redesigned overview/dashboard.

**Architecture:** Keep all API and data logic unchanged. Add small shared UI primitives under `web/components/ui/` and use them from the app shell and first two surfaces. The first PR establishes the new visual language without touching the larger `ResearchTool` or result rendering internals.

**Tech Stack:** Next.js App Router 16.2.6, React 19, Tailwind CSS v4, Geist fonts, `react-icons`.

---

## File Structure

- Create `web/components/ui/signal-ui.tsx`
  - Shared presentational primitives: `LogoMark`, `IconTile`, `Surface`, `PrimaryAction`, `SecondaryAction`, `Pill`, `PageIntro`, `MetricCard`, `EmptyState`, and app nav metadata.
  - This file must stay client/server safe: no hooks and no browser APIs.

- Modify `web/app/globals.css`
  - Add Apple-inspired CSS variables and reusable utility classes.
  - Preserve existing animation names used by current components.

- Modify `web/app/app/layout.tsx`
  - Replace dark sidebar + emoji navigation with a light rail, translucent top bar, and non-emoji mobile nav.
  - Keep auth behavior exactly as-is: `currentUser()`, `logout()`, `AuthModal`.

- Modify `web/app/Landing.tsx`
  - Replace current orbit-logo hero with a stronger Apple-style hero and product preview.
  - Keep public page behavior exactly as-is: `onSearch`, `onDemo`, `user`, `onLoginClick`, `onLogout`.

- Modify `web/app/app/page.tsx`
  - Redesign overview around “今日焦点” and next actions.
  - Keep `/api/overview` fetching and polling behavior unchanged.

- Verify with:
  - `./node_modules/.bin/eslint app/app/layout.tsx app/Landing.tsx app/app/page.tsx components/ui/signal-ui.tsx`
  - `./node_modules/.bin/tsc --noEmit`
  - `npm run build`
  - Browser screenshots for `/`, `/app`, `/app/projects` at desktop and mobile widths.

---

## Task 1: Shared UI Primitives

**Files:**
- Create: `web/components/ui/signal-ui.tsx`

- [ ] **Step 1: Create shared UI primitives**

Create `web/components/ui/signal-ui.tsx` with this structure:

```tsx
import Link from "next/link";
import type { IconType } from "react-icons";
import {
  FiActivity,
  FiCheckCircle,
  FiClock,
  FiClipboard,
  FiFolder,
  FiHome,
  FiLogOut,
  FiPlus,
  FiSearch,
  FiSettings,
  FiUser,
} from "react-icons/fi";

export type AppNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  Icon: IconType;
};

export const APP_NAV: AppNavItem[] = [
  { href: "/app", label: "总览", shortLabel: "总览", Icon: FiHome },
  { href: "/app/projects", label: "招聘项目", shortLabel: "项目", Icon: FiFolder },
  { href: "/app/search", label: "智能搜人", shortLabel: "搜人", Icon: FiSearch },
  { href: "/app/verify", label: "核验台", shortLabel: "核验", Icon: FiCheckCircle },
  { href: "/app/shortlist", label: "候选池", shortLabel: "候选", Icon: FiClipboard },
  { href: "/app/history", label: "历史", shortLabel: "历史", Icon: FiClock },
];

export const SETTINGS_NAV = { href: "/app/settings", label: "设置", shortLabel: "设置", Icon: FiSettings };

export function LogoMark({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const stroke = tone === "light" ? "#ffffff" : "#1d1d1f";
  return (
    <svg viewBox="0 0 512 512" className={className} aria-hidden="true">
      <g stroke={stroke} strokeWidth={22} fill="none" strokeLinecap="round">
        <circle cx="256" cy="256" r="130" />
        <circle cx="256" cy="256" r="70" />
        <path d="M186 256a70 70 0 1 0 70-70" />
      </g>
      <circle cx="256" cy="256" r="16" fill="#7ee787" />
    </svg>
  );
}

export function Surface({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`sh-surface ${className}`}>{children}</section>;
}

export function IconTile({ Icon, tone = "neutral" }: { Icon: IconType; tone?: "neutral" | "blue" | "green" | "amber" }) {
  const toneClass = {
    neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
    blue: "bg-blue-50 text-blue-600 ring-blue-100",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
  }[tone];
  return (
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ring-1 ${toneClass}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

export function PrimaryAction({
  href,
  onClick,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = `sh-primary-action ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function SecondaryAction({
  href,
  onClick,
  children,
  className = "",
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = `sh-secondary-action ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button type="button" onClick={onClick} className={cls}>{children}</button>;
}

export function Pill({ children, active = false, className = "" }: { children: React.ReactNode; active?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1 ${active ? "bg-neutral-950 text-white ring-neutral-950" : "bg-white/80 text-neutral-600 ring-black/10"} ${className}`}>
      {children}
    </span>
  );
}

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</p>}
        <h1 className="mt-2 text-4xl font-semibold leading-tight text-[var(--sh-ink)] md:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--sh-muted)]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  Icon = FiActivity,
  tone = "neutral",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  Icon?: IconType;
  tone?: "neutral" | "blue" | "green" | "amber";
}) {
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--sh-muted)]">{label}</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-[var(--sh-ink)] tabular-nums">{value}</p>
          {sub && <p className="mt-1 text-xs text-[var(--sh-faint)]">{sub}</p>}
        </div>
        <IconTile Icon={Icon} tone={tone} />
      </div>
    </Surface>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Surface className="p-8 text-center">
      <p className="text-base font-semibold text-[var(--sh-ink)]">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--sh-muted)]">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </Surface>
  );
}

export { FiLogOut, FiPlus, FiSearch, FiUser };
```

- [ ] **Step 2: Run TypeScript against the new file**

Run:

```bash
cd web
./node_modules/.bin/tsc --noEmit
```

Expected: TypeScript may fail because the new file is not imported yet only if the import surface has type issues. Fix only type issues in `components/ui/signal-ui.tsx`.

- [ ] **Step 3: Commit shared primitives**

Run:

```bash
git add web/components/ui/signal-ui.tsx
git commit -m "feat: add signal ui primitives"
```

---

## Task 2: Global Visual Tokens

**Files:**
- Modify: `web/app/globals.css`

- [ ] **Step 1: Update global tokens and utility classes**

Replace the existing `:root`, `html`, and `body` sections in `web/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #f5f5f7;
  --foreground: #1d1d1f;
  --sh-canvas: #f5f5f7;
  --sh-ink: #1d1d1f;
  --sh-muted: #6e6e73;
  --sh-faint: #86868b;
  --sh-line: rgba(0, 0, 0, 0.08);
  --sh-surface: rgba(255, 255, 255, 0.82);
  --sh-surface-strong: #ffffff;
  --sh-blue: #0071e3;
  --sh-blue-hover: #0077ed;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

html {
  color-scheme: light;
  background: var(--sh-canvas);
}

body {
  min-height: 100%;
  background:
    radial-gradient(circle at top left, rgba(255, 255, 255, 0.86), transparent 34rem),
    var(--sh-canvas);
  color: var(--foreground);
  font-family: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI",
    Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
}

.sh-surface {
  border: 1px solid var(--sh-line);
  border-radius: 24px;
  background: var(--sh-surface);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.05);
  backdrop-filter: blur(24px);
}

.sh-primary-action {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 999px;
  background: var(--sh-blue);
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  transition: transform 180ms ease, background 180ms ease, box-shadow 180ms ease;
  box-shadow: 0 12px 30px rgba(0, 113, 227, 0.24);
}

.sh-primary-action:hover {
  background: var(--sh-blue-hover);
  transform: translateY(-1px);
}

.sh-secondary-action {
  display: inline-flex;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border: 1px solid var(--sh-line);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.76);
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sh-ink);
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

.sh-secondary-action:hover {
  border-color: rgba(0, 0, 0, 0.18);
  background: white;
  transform: translateY(-1px);
}
```

Keep the existing `@keyframes sh-float`, `@keyframes sh-fade-in-up`, `@keyframes sh-fade-in`, utility animation classes, and reduced-motion media query below these sections.

- [ ] **Step 2: Verify CSS syntax through build**

Run:

```bash
cd web
npm run build
```

Expected: Build succeeds. If Tailwind reports an unknown utility, fix only the class that caused the error.

- [ ] **Step 3: Commit tokens**

Run:

```bash
git add web/app/globals.css
git commit -m "style: add apple inspired visual tokens"
```

---

## Task 3: Console Chrome Redesign

**Files:**
- Modify: `web/app/app/layout.tsx`
- Use: `web/components/ui/signal-ui.tsx`

- [ ] **Step 1: Replace local nav metadata and logo**

In `web/app/app/layout.tsx`, remove the local `NAV` array and local `LogoMark`. Import from shared primitives:

```tsx
import {
  APP_NAV,
  FiLogOut,
  LogoMark,
  SETTINGS_NAV,
} from "@/components/ui/signal-ui";
```

- [ ] **Step 2: Replace `Sidebar` with light rail**

Replace the existing `Sidebar` component with:

```tsx
function isActivePath(currentPath: string, href: string) {
  return currentPath === href || (href !== "/app" && currentPath.startsWith(href));
}

function Sidebar({ user, currentPath, onLogout }: { user: User; currentPath: string; onLogout: () => void }) {
  return (
    <aside className="hidden w-[216px] shrink-0 border-r border-black/5 bg-white/72 px-3 py-4 backdrop-blur-2xl md:flex md:flex-col">
      <Link href="/" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-[var(--sh-ink)]">
        <LogoMark className="h-7 w-7" />
        <span className="text-[15px] font-semibold tracking-tight">SignalHire</span>
      </Link>

      <nav className="mt-6 flex-1 space-y-1">
        {APP_NAV.map((item) => {
          const active = isActivePath(currentPath, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-neutral-950 text-white shadow-[0_12px_30px_rgba(0,0,0,0.14)]"
                  : "text-neutral-500 hover:bg-white hover:text-neutral-950"
              }`}
            >
              <item.Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-black/5 pt-3">
        <Link
          href={SETTINGS_NAV.href}
          className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
            isActivePath(currentPath, SETTINGS_NAV.href)
              ? "bg-neutral-950 text-white"
              : "text-neutral-500 hover:bg-white hover:text-neutral-950"
          }`}
        >
          <SETTINGS_NAV.Icon className="h-4 w-4" aria-hidden="true" />
          <span>{SETTINGS_NAV.label}</span>
        </Link>
        <div className="rounded-2xl bg-white/70 px-3 py-3 ring-1 ring-black/5">
          <p className="truncate text-xs text-[var(--sh-muted)]" title={user.email}>{user.email}</p>
          <button
            onClick={onLogout}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-950"
          >
            <FiLogOut className="h-3.5 w-3.5" aria-hidden="true" />
            退出
          </button>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 3: Replace mobile top and bottom nav**

Update `MobileTopBar` to use `LogoMark` and remove inline SVG. Update `MobileBottomNav` to iterate over `APP_NAV.slice(0, 5)` and render `item.Icon`, not emoji.

The mobile bottom link body should be:

```tsx
<item.Icon className="h-5 w-5" aria-hidden="true" />
<span>{item.shortLabel}</span>
```

- [ ] **Step 4: Update shell background and main width**

In the final return, change the shell wrappers to:

```tsx
<div className="flex min-h-screen bg-[var(--sh-canvas)] text-[var(--sh-ink)]">
  <Sidebar user={user} currentPath={pathname} onLogout={handleLogout} />
  <div className="flex min-w-0 flex-1 flex-col">
    <MobileTopBar user={user} onLogout={handleLogout} />
    <main className="flex-1 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-8">
      <div className="mx-auto w-full max-w-7xl">{children}</div>
    </main>
    <MobileBottomNav currentPath={pathname} />
  </div>
</div>
```

- [ ] **Step 5: Verify shell**

Run:

```bash
cd web
./node_modules/.bin/eslint app/app/layout.tsx components/ui/signal-ui.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both pass.

- [ ] **Step 6: Commit console chrome**

Run:

```bash
git add web/app/app/layout.tsx
git commit -m "feat: redesign console chrome"
```

---

## Task 4: Public Landing First Screen

**Files:**
- Modify: `web/app/Landing.tsx`
- Use: `web/components/ui/signal-ui.tsx`

- [ ] **Step 1: Replace duplicate logo**

Remove local `LogoMark` from `web/app/Landing.tsx` and import:

```tsx
import { LogoMark, PrimaryAction, SecondaryAction } from "@/components/ui/signal-ui";
```

- [ ] **Step 2: Replace the hero orbit with a product preview**

Remove the desktop-only concentric ring and `ORBIT` bubble rendering from the hero. Keep source logos for the trust/source strip lower on the page if desired, but the first viewport should focus on product and search.

Add this helper component in `Landing.tsx`:

```tsx
function ProductPreview() {
  const candidates = [
    { name: "Ava Chen", role: "LLM Systems Lead", score: 94, evidence: "8 信源" },
    { name: "Mateo Rossi", role: "Inference Runtime Engineer", score: 89, evidence: "6 信源" },
    { name: "Nora Singh", role: "AI Infra Researcher", score: 86, evidence: "7 信源" },
  ];
  return (
    <div className="mx-auto mt-10 grid max-w-5xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="sh-surface p-5 text-left">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Shortlist preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">AI Infra 候选人</h2>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">证据强</span>
        </div>
        <div className="mt-5 space-y-3">
          {candidates.map((candidate) => (
            <div key={candidate.name} className="rounded-2xl bg-white/82 p-4 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--sh-ink)]">{candidate.name}</p>
                  <p className="mt-1 text-xs text-[var(--sh-muted)]">{candidate.role}</p>
                </div>
                <span className="rounded-full bg-neutral-950 px-2.5 py-1 text-xs font-semibold text-white">{candidate.score}</span>
              </div>
              <p className="mt-3 text-xs text-[var(--sh-muted)]">{candidate.evidence} · GitHub / arXiv / 公司页面交叉验证</p>
            </div>
          ))}
        </div>
      </div>
      <div className="sh-surface p-5 text-left">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Evidence audit</p>
        <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">每条声称都能回到来源</h2>
        <div className="mt-5 space-y-3">
          {["维护 vLLM 推理项目", "发表过系统方向论文", "曾在生产环境负责模型服务"].map((claim, index) => (
            <div key={claim} className="rounded-2xl bg-white/82 p-4 ring-1 ring-black/5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-[var(--sh-ink)]">{claim}</p>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">{index === 1 ? "待核实" : "已验证"}</span>
              </div>
              <p className="mt-2 text-xs text-[var(--sh-muted)]">来源 {index + 3} 个 · 可点击查看原始页面</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Restyle the top nav and hero**

The hero should:

- Use a top nav with `rounded-full`, `bg-white/72`, `backdrop-blur-2xl`, and minimal links.
- Use H1 text: `Find AI talent by evidence.`
- Put Chinese supporting copy below it: `为 HR 和猎头生成全球 AI 人才 shortlist、交叉验证证据和候选人风险摘要。`
- Keep the existing search textarea behavior and keyboard shortcut.
- Use `PrimaryAction`/`SecondaryAction` styles for buttons where they do not break form submit behavior.
- Render `<ProductPreview />` below the search form.

- [ ] **Step 4: Verify landing page**

Run:

```bash
cd web
./node_modules/.bin/eslint app/Landing.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both pass. The page still accepts search input and still opens auth for unauthenticated users through existing callbacks.

- [ ] **Step 5: Commit landing first screen**

Run:

```bash
git add web/app/Landing.tsx
git commit -m "feat: redesign landing hero"
```

---

## Task 5: Overview Redesign

**Files:**
- Modify: `web/app/app/page.tsx`
- Use: `web/components/ui/signal-ui.tsx`

- [ ] **Step 1: Import shared primitives and icons**

Add:

```tsx
import {
  EmptyState,
  FiPlus,
  FiSearch,
  MetricCard,
  PageIntro,
  PrimaryAction,
  SecondaryAction,
  Surface,
} from "@/components/ui/signal-ui";
import { FiAlertTriangle, FiBriefcase, FiCheckCircle, FiClipboard } from "react-icons/fi";
```

- [ ] **Step 2: Replace KPI config icons**

Replace emoji icons with icon references:

```tsx
const KPI_CONFIG: { key: keyof Kpi; label: string; sub: string; tone: "neutral" | "blue" | "green" | "amber"; Icon: typeof FiBriefcase }[] = [
  { key: "projects_open", label: "进行中项目", sub: "个", tone: "blue", Icon: FiBriefcase },
  { key: "searches_this_month", label: "本月搜人", sub: "次研究", tone: "neutral", Icon: FiSearch },
  { key: "verifies_total", label: "已核验候选人", sub: "份报告", tone: "amber", Icon: FiCheckCircle },
  { key: "shortlist_total", label: "候选池", sub: "人", tone: "green", Icon: FiClipboard },
  { key: "red_flags_total", label: "红旗", sub: "个", tone: "amber", Icon: FiAlertTriangle },
];
```

- [ ] **Step 3: Replace top header with PageIntro**

The first rendered block should be:

```tsx
<PageIntro
  eyebrow="SignalHire 工作台"
  title="今天先推进最重要的人才搜索。"
  description="从正在进行的项目、候选人审阅和最新研究结果继续，不需要重新组织线索。"
  actions={
    <>
      <PrimaryAction href="/app/search"><FiSearch className="h-4 w-4" aria-hidden="true" /> 智能搜人</PrimaryAction>
      <SecondaryAction href="/app/projects"><FiPlus className="h-4 w-4" aria-hidden="true" /> 新建项目</SecondaryAction>
    </>
  }
/>
```

- [ ] **Step 4: Replace KPI cards with MetricCard**

Render metrics as a compact strip:

```tsx
<section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
  {KPI_CONFIG.map((cfg) => (
    <MetricCard
      key={cfg.key}
      label={cfg.label}
      value={data ? data.kpi[cfg.key] : "—"}
      sub={cfg.sub}
      Icon={cfg.Icon}
      tone={cfg.tone}
    />
  ))}
</section>
```

- [ ] **Step 5: Restyle project and task sections**

Keep existing data mapping, but replace section containers with `Surface` and use headings:

```tsx
<Surface className="p-5">
  <div className="flex items-end justify-between gap-3">
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">继续项目</p>
      <h2 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">进行中招聘项目</h2>
    </div>
    <Link href="/app/projects" className="text-sm font-medium text-blue-600 hover:text-blue-700">查看全部</Link>
  </div>
  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    {data.active_projects.map((p) => (
      <Link key={p.id} href={`/app/projects/${p.id}`} className="rounded-2xl bg-white/82 p-4 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-white">
        <p className="line-clamp-2 text-sm font-semibold text-[var(--sh-ink)]">{p.name}</p>
        {p.brief && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--sh-muted)]">{p.brief}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs text-[var(--sh-muted)]">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5">{p.candidates_total} 候选人</span>
          {p.runs_active > 0 && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{p.runs_active} 研究中</span>}
        </div>
      </Link>
    ))}
  </div>
</Surface>
```

Use similar `Surface` wrappers for active jobs and recent research. Do not alter fetch logic, polling logic, or link destinations.

- [ ] **Step 6: Replace empty state**

Replace the current onboarding empty state with:

```tsx
{empty && (
  <EmptyState
    title="开始第一轮 AI 人才搜索"
    description="创建项目或直接描述人才画像，SignalHire 会生成 shortlist、证据摘要和下一轮优化建议。"
    action={<PrimaryAction href="/app/search">开始搜人</PrimaryAction>}
  />
)}
```

- [ ] **Step 7: Verify overview**

Run:

```bash
cd web
./node_modules/.bin/eslint app/app/page.tsx components/ui/signal-ui.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both pass.

- [ ] **Step 8: Commit overview redesign**

Run:

```bash
git add web/app/app/page.tsx
git commit -m "feat: redesign overview workspace"
```

---

## Task 6: Phase 1 Verification

**Files:**
- Inspect: `/`, `/app`, `/app/projects`
- Commands from repo root and `web`

- [ ] **Step 1: Run targeted tests**

Run from repo root:

```bash
node --test auth-session-sync.test.mjs search-page-state.test.mjs research-progress.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend verification**

Run:

```bash
cd web
./node_modules/.bin/eslint app/app/layout.tsx app/Landing.tsx app/app/page.tsx components/ui/signal-ui.tsx
./node_modules/.bin/tsc --noEmit
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Start dev server**

Run:

```bash
cd web
npm run dev
```

Expected: server starts on `http://localhost:3000` or the next available port.

- [ ] **Step 4: Browser visual checks**

Use browser automation or manual browser review:

- Desktop `/`: hero is strong and uncluttered, no orbit bubbles in first viewport, search form works.
- Desktop `/app`: light rail navigation, no emoji nav, overview has clear primary action.
- Desktop `/app/projects`: inherited shell looks correct.
- Mobile `/`: hero text and search form do not overlap.
- Mobile `/app`: top bar and bottom nav do not overlap content.

- [ ] **Step 5: Fix only Phase 1 regressions**

Allowed fixes:

- Layout overflow.
- Text overlap.
- Type errors.
- Broken imports.
- Console errors from changed UI.

Not allowed in this phase:

- Rewriting `ResearchTool` internals.
- Changing API routes.
- Changing DB schema.
- Redesigning candidate/result components beyond what overview imports require.

- [ ] **Step 6: Final commit if fixes were needed**

Run:

```bash
git add web/app/globals.css web/app/app/layout.tsx web/app/Landing.tsx web/app/app/page.tsx web/components/ui/signal-ui.tsx
git commit -m "fix: polish phase 1 ui shell"
```

Only commit if Step 5 made additional changes after earlier commits.

---

## Phase 1 Completion Criteria

Phase 1 is complete only when:

- The shared UI primitive file exists and is used by shell, landing, and overview.
- Main console navigation no longer uses emoji icons.
- Public hero is redesigned around SignalHire and the search input.
- Overview is redesigned around next actions and active work.
- `/`, `/app`, and `/app/projects` render without obvious layout defects at desktop and mobile widths.
- `node --test auth-session-sync.test.mjs search-page-state.test.mjs research-progress.test.mjs` passes.
- `web` lint, TypeScript, and production build pass.

---

## Follow-up Phase Plans

After Phase 1 lands, write separate implementation plans for:

1. Phase 2: `/app/search`, `/app/verify`, `ResearchTool`, real-time timeline, result summary-first layout.
2. Phase 3: project list/detail, candidate work area, shortlist review surface.
3. Phase 4: public report `/r/[id]`, empty/error/loading states, final responsive screenshot verification.
