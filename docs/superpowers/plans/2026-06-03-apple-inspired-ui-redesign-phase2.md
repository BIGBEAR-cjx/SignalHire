# Apple Inspired UI Redesign Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the core search and verification workflow so users experience SignalHire as an Apple-inspired AI research workspace: focused input, editable plan, live research timeline, and summary-first results.

**Architecture:** Keep the `ResearchTool` state machine, API calls, queue polling, cancellation, feedback, backfill, shortlist, and outreach behavior unchanged. Extract presentation components into `web/components/research-workspace.tsx`, then replace only JSX in `ResearchTool`, `/app/search`, and `/app/verify`.

**Tech Stack:** Next.js App Router 16.2.6, React 19, Tailwind CSS v4, Geist fonts, `react-icons`, existing `web/components/ui/signal-ui.tsx`.

---

## File Structure

- Create `web/components/research-workspace.tsx`
  - Shared display-only components for the search/verify workflow.
  - No hooks, no fetch calls, no app state.
  - Exports:
    - `ProjectContextBanner`
    - `ResearchInputStage`
    - `EditableSearchPlanPanel`
    - `ResearchTimelinePanel`
    - `ResearchErrorPanel`
    - `ResearchResultShell`
    - `ResearchShareBar`

- Modify `web/app/app/search/page.tsx`
  - Replace local header with `PageIntro`.
  - Keep `useSearchParams`, project-name fetch, and `shouldAutoRunInitialSearch` unchanged.

- Modify `web/app/app/verify/page.tsx`
  - Replace local header with `PageIntro`.
  - Keep demo/bio/project behavior unchanged.

- Modify `web/components/ResearchTool.tsx`
  - Import and use the new display components.
  - Preserve current functions and state names.
  - Keep all API routes and body shapes unchanged.

- Optional small addition to `web/components/ui/signal-ui.tsx`
  - Export `FiArrowLeft`, `FiEdit3`, `FiPlay`, `FiShare2`, `FiSquare`, `FiZap` if needed by the new display components.

---

## Task 1: Research Workspace Display Components

**Files:**
- Create: `web/components/research-workspace.tsx`
- Modify if needed: `web/components/ui/signal-ui.tsx`

- [ ] **Step 1: Add display component file**

Create `web/components/research-workspace.tsx` with these props and components:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { FiArrowLeft, FiCheckCircle, FiEdit3, FiPlay, FiSearch, FiShare2, FiSquare, FiZap } from "react-icons/fi";
import { PrimaryAction, SecondaryAction, Surface } from "@/components/ui/signal-ui";

export type ResearchTimelineItem = {
  id: number;
  kind: "search" | "fetch";
  label: string;
  detail: string;
};

export function ProjectContextBanner({
  projectId,
  projectName,
  mode,
}: {
  projectId: string;
  projectName?: string;
  mode: "search" | "verify";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50/80 px-4 py-2 text-sm text-emerald-900">
      <FiCheckCircle className="h-4 w-4" aria-hidden="true" />
      <span>在项目 <span className="font-semibold">{projectName ?? "本项目"}</span> 下{mode === "search" ? "搜人" : "核验"}</span>
      <span className="text-emerald-700/80">结果和收藏会自动归档</span>
      <span className="flex-1" />
      <Link href={`/app/projects/${projectId}`} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 hover:text-emerald-950">
        <FiArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        回项目
      </Link>
    </div>
  );
}

export function ResearchInputStage({
  mode,
  input,
  onInputChange,
  onRun,
  onCreatePlan,
  loading,
}: {
  mode: "search" | "verify";
  input: string;
  onInputChange: (value: string) => void;
  onRun: () => void;
  onCreatePlan?: () => void;
  loading: boolean;
}) {
  const isSearch = mode === "search";
  return (
    <Surface className="overflow-hidden p-0">
      <div className="px-5 py-5 md:px-7 md:py-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{isSearch ? "Talent search brief" : "Candidate verification"}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--sh-ink)]">{isSearch ? "描述你要找的 AI 人才画像。" : "粘贴候选人材料，开始证据核验。"}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--sh-muted)]">
              {isSearch
                ? "先写完整画像，再决定是否生成可编辑搜索计划或直接开始深度研究。"
                : "可粘贴候选人自述、简历、LinkedIn 简介或公开链接；系统会按声明逐条对账。"}
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${isSearch ? "bg-blue-50 text-blue-700 ring-blue-100" : "bg-amber-50 text-amber-800 ring-amber-100"}`}>
            {isSearch ? "Shortlist + 证据" : "可信度报告"}
          </span>
        </div>
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          rows={isSearch ? 6 : 8}
          placeholder={
            isSearch
              ? "例如：找做过 LLM inference / serving、熟悉 vLLM 或 Triton、能做 AI infra 落地的 senior engineer，北美或欧洲优先，可远程"
              : "粘贴候选人的自述 / 简历 / LinkedIn 介绍。我们会对每条声称做跨源核实，给出 verified / contradicted / unverified 报告。"
          }
          className="mt-5 block max-h-[46vh] min-h-[180px] w-full resize-y rounded-[22px] border border-black/10 bg-white/72 px-4 py-4 text-[15px] leading-7 text-[var(--sh-ink)] outline-none transition placeholder:text-[var(--sh-faint)] focus:border-black/20 focus:bg-white"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PrimaryAction onClick={onRun} className="px-5" disabled={loading || !input.trim()}>
            {loading ? <FiZap className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <FiPlay className="h-4 w-4" aria-hidden="true" />}
            {loading ? (isSearch ? "正在研究候选人" : "正在核验证据") : (isSearch ? "开始深度研究" : "开始核验")}
          </PrimaryAction>
          {isSearch && onCreatePlan && (
            <SecondaryAction onClick={onCreatePlan} className="px-5" disabled={loading || !input.trim()}>
              <FiEdit3 className="h-4 w-4" aria-hidden="true" />
              生成搜索计划
            </SecondaryAction>
          )}
          <span className="text-xs text-[var(--sh-faint)]">{input.length} 字</span>
        </div>
      </div>
    </Surface>
  );
}

export function EditableSearchPlanPanel({
  children,
  onRunPlan,
  loading,
}: {
  children: ReactNode;
  onRunPlan: () => void;
  loading: boolean;
}) {
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Search plan</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--sh-ink)]">先调整搜索策略，再启动研究。</h3>
        </div>
        <PrimaryAction onClick={onRunPlan} disabled={loading}>
          <FiPlay className="h-4 w-4" aria-hidden="true" />
          按计划搜索
        </PrimaryAction>
      </div>
      <div className="mt-5">{children}</div>
    </Surface>
  );
}

export function ResearchTimelinePanel({
  label,
  detail,
  statsText,
  timeline,
  statusDetail,
  onStop,
}: {
  label?: string;
  detail?: string;
  statsText: string;
  timeline: ResearchTimelineItem[];
  statusDetail?: string;
  onStop: () => void;
}) {
  return (
    <Surface className="p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--sh-ink)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            实时研究轨迹
          </div>
          <p className="mt-1 text-sm text-[var(--sh-muted)]">{label ?? "正在准备第一批搜索事件"}</p>
        </div>
        <SecondaryAction onClick={onStop} className="min-h-9 px-3 py-2 text-xs">
          <FiSquare className="h-3.5 w-3.5" aria-hidden="true" />
          停止搜索
        </SecondaryAction>
      </div>
      {statusDetail && <p className="mt-3 text-xs leading-5 text-[var(--sh-muted)]">{statusDetail}</p>}
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
        <div className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-4">
          <p className="text-xs font-semibold text-emerald-700">当前动作</p>
          <p className="mt-2 break-all font-mono text-sm leading-6 text-[var(--sh-ink)]">{detail ?? "正在生成搜索计划"}</p>
        </div>
        <div className="rounded-3xl bg-white/72 p-4 ring-1 ring-black/5">
          <p className="text-xs font-semibold text-[var(--sh-muted)]">进度</p>
          <p className="mt-2 text-sm font-semibold text-[var(--sh-ink)]">{statsText}</p>
        </div>
      </div>
      {timeline.length === 0 ? (
        <p className="mt-4 text-xs text-[var(--sh-faint)]">搜索词、抓取页面和交叉验证动作会在这里实时展开。</p>
      ) : (
        <ol className="mt-5 max-h-80 space-y-3 overflow-auto pr-1">
          {timeline.map((item) => (
            <li key={`${item.id}-${item.kind}`} className="rounded-2xl bg-white/72 px-3 py-3 ring-1 ring-black/5">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--sh-muted)]">
                  {item.kind === "search" ? <FiSearch className="h-3.5 w-3.5" aria-hidden="true" /> : <FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" />}
                  {item.label}
                </span>
                <span className="text-[11px] text-[var(--sh-faint)]">#{item.id + 1}</span>
              </div>
              <p className="mt-2 break-all font-mono text-xs leading-relaxed text-[var(--sh-ink)]">{item.detail}</p>
            </li>
          ))}
        </ol>
      )}
    </Surface>
  );
}

export function ResearchErrorPanel({
  error,
  canRetry,
  onRetry,
}: {
  error: string;
  canRetry?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-100 bg-red-50/90 p-4 text-sm text-red-700">
      <p>出错：{error}</p>
      {canRetry && onRetry && (
        <button onClick={onRetry} className="mt-3 rounded-full bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800">
          重新研究
        </button>
      )}
    </div>
  );
}

export function ResearchShareBar({
  statsText,
  cached,
  copied,
  onCopy,
}: {
  statsText?: string;
  cached?: boolean;
  copied: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-[var(--sh-muted)]">
        {cached ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-100">预缓存 · 秒出</span> : statsText}
      </p>
      {onCopy && (
        <button onClick={onCopy} className="sh-secondary-action min-h-9 px-3 py-2 text-xs">
          <FiShare2 className="h-3.5 w-3.5" aria-hidden="true" />
          {copied ? "链接已复制" : "分享报告"}
        </button>
      )}
    </div>
  );
}

export function ResearchResultShell({ children }: { children: ReactNode }) {
  return <div className="space-y-5">{children}</div>;
}
```

- [ ] **Step 2: Add disabled support to shared actions**

If TypeScript rejects `disabled` on `PrimaryAction` or `SecondaryAction`, update `web/components/ui/signal-ui.tsx`:

```tsx
export function PrimaryAction({
  href,
  onClick,
  children,
  className = "",
  disabled = false,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const cls = `sh-primary-action ${disabled ? "pointer-events-none opacity-50" : ""} ${className}`;
  if (href) return <Link href={href} className={cls} aria-disabled={disabled}>{children}</Link>;
  return <button type="button" onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}
```

Apply the same `disabled` prop shape to `SecondaryAction`.

- [ ] **Step 3: Verify display components**

Run:

```bash
cd web
./node_modules/.bin/eslint components/research-workspace.tsx components/ui/signal-ui.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 4: Commit display components**

Run:

```bash
git add web/components/research-workspace.tsx web/components/ui/signal-ui.tsx
git commit -m "feat: add research workspace components"
```

---

## Task 2: Search and Verify Page Entrances

**Files:**
- Modify: `web/app/app/search/page.tsx`
- Modify: `web/app/app/verify/page.tsx`

- [ ] **Step 1: Update search page intro**

Import `PageIntro` and `FiSearch`:

```tsx
import { FiSearch } from "react-icons/fi";
import { PageIntro } from "@/components/ui/signal-ui";
```

Replace the local `<header>` in `SearchInner` with:

```tsx
<PageIntro
  eyebrow={projectName ? "项目内搜人" : "智能搜人"}
  title="把人才画像变成可审阅 shortlist。"
  description={projectName ? `当前项目：${projectName}。先调整搜索条件，再手动启动深度研究。` : "描述 AI 人才画像，SignalHire 会拆解搜索策略、实时检索来源，并输出带证据的候选人列表。"}
  actions={<span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10"><FiSearch className="h-3.5 w-3.5" aria-hidden="true" /> Search workspace</span>}
/>
```

- [ ] **Step 2: Update verify page intro**

Import `FiCheckCircle` and `PageIntro`:

```tsx
import { FiCheckCircle } from "react-icons/fi";
import { PageIntro } from "@/components/ui/signal-ui";
```

Replace the local `<header>` in `VerifyInner` with:

```tsx
<PageIntro
  eyebrow={projectName ? "项目内核验" : "候选人核验台"}
  title="把候选人自述拆成可核验证据。"
  description={projectName ? `当前项目：${projectName}。核验结果会回到项目上下文。` : "粘贴候选人材料，系统会按声明逐条查证，输出可信度、红旗和可点击来源。"}
  actions={<span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-[var(--sh-muted)] ring-1 ring-black/10"><FiCheckCircle className="h-3.5 w-3.5" aria-hidden="true" /> Evidence audit</span>}
/>
```

- [ ] **Step 3: Verify entrances**

Run:

```bash
cd web
./node_modules/.bin/eslint app/app/search/page.tsx app/app/verify/page.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 4: Commit page entrances**

Run:

```bash
git add web/app/app/search/page.tsx web/app/app/verify/page.tsx
git commit -m "feat: redesign research page intros"
```

---

## Task 3: ResearchTool Input, Plan, Progress, Error, and Share Shell

**Files:**
- Modify: `web/components/ResearchTool.tsx`
- Use: `web/components/research-workspace.tsx`

- [ ] **Step 1: Import new display components**

Add:

```tsx
import {
  EditableSearchPlanPanel,
  ProjectContextBanner,
  ResearchErrorPanel,
  ResearchInputStage,
  ResearchResultShell,
  ResearchShareBar,
  ResearchTimelinePanel,
} from "@/components/research-workspace";
```

- [ ] **Step 2: Replace project context banner**

Replace the project banner JSX with:

```tsx
{projectId && (
  <ProjectContextBanner
    projectId={projectId}
    projectName={projectName}
    mode={mode}
  />
)}
```

- [ ] **Step 3: Replace input card**

Replace the existing input-area card through the opening of the editable plan block with:

```tsx
<ResearchInputStage
  mode={mode}
  input={input}
  onInputChange={setInput}
  onRun={() => run()}
  onCreatePlan={isSearch ? createEditablePlan : undefined}
  loading={loading}
/>
```

Keep the editable plan internals, but wrap them with `EditableSearchPlanPanel`:

```tsx
{isSearch && editablePlan && (
  <EditableSearchPlanPanel onRunPlan={runEditablePlan} loading={loading}>
    <div className="grid gap-4 md:grid-cols-3">
      {/* Keep the three existing label blocks for `must_have`, `nice_to_have`, and `exclusions` here. Do not change their `value`, `onChange`, or `updateEditablePlanList` calls. */}
    </div>
    <div className="mt-4 space-y-3">
      {/* Keep the existing source strategy map editor here. Do not change `updateEditableSource`, input names, or textarea values. */}
    </div>
  </EditableSearchPlanPanel>
)}
```

- [ ] **Step 4: Replace progress card**

Replace the entire loading progress card with:

```tsx
{loading && (
  <ResearchTimelinePanel
    label={jobStatus?.label ?? progressView.active?.label}
    detail={progressView.active?.detail}
    statsText={progressView.statsText}
    timeline={progressView.timeline}
    statusDetail={jobStatus?.detail ?? undefined}
    onStop={stopCurrentRun}
  />
)}
```

- [ ] **Step 5: Replace error card**

Replace the error JSX with:

```tsx
{error && (
  <ResearchErrorPanel
    error={error}
    canRetry={Boolean(jobStatus?.canRetry && currentJobId)}
    onRetry={jobStatus?.canRetry && currentJobId ? retryCurrentJob : undefined}
  />
)}
```

- [ ] **Step 6: Replace result shell and share bar**

Replace the result wrapper opening:

```tsx
{result && (
  <ResearchResultShell>
    <ResearchShareBar
      statsText={stats ? `本次研究: 网页搜索 ${stats.searches} 次 · 抓取 ${stats.fetches} 次` : undefined}
      cached={Boolean(stats?.cached)}
      copied={copied}
      onCopy={runId ? () => {
        navigator.clipboard?.writeText(`${location.origin}/r/${runId}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } : undefined}
    />
    {/* Move the existing talent search / verify / legacy result rendering body here unchanged, starting from `{isTalentSearchResult(result) ? (` through the existing fallback candidate card rendering. */}
  </ResearchResultShell>
)}
```

- [ ] **Step 7: Verify behavior-preserving JSX change**

Run:

```bash
cd web
./node_modules/.bin/eslint components/ResearchTool.tsx components/research-workspace.tsx components/ui/signal-ui.tsx
./node_modules/.bin/tsc --noEmit
```

Expected: both commands pass.

- [ ] **Step 8: Commit ResearchTool shell**

Run:

```bash
git add web/components/ResearchTool.tsx web/components/research-workspace.tsx web/components/ui/signal-ui.tsx
git commit -m "feat: redesign research workflow shell"
```

---

## Task 4: Phase 2 Verification

**Files:**
- Inspect: `/app/search`, `/app/verify`

- [ ] **Step 1: Run lightweight regression tests**

Run from repo root:

```bash
node --test auth-session-sync.test.mjs search-page-state.test.mjs research-progress.test.mjs
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend checks**

Run:

```bash
cd web
./node_modules/.bin/eslint app/app/search/page.tsx app/app/verify/page.tsx components/ResearchTool.tsx components/research-workspace.tsx components/ui/signal-ui.tsx
./node_modules/.bin/tsc --noEmit
npm run build
```

Expected: all commands pass.

- [ ] **Step 3: Check source for regressions**

Run:

```bash
rg -n "fetch\\(|/api/search|/api/verify|/api/cancel|/api/status|setInterval|AbortController" web/components/ResearchTool.tsx
```

Expected: existing API calls and cancellation/polling logic remain in `ResearchTool.tsx`.

- [ ] **Step 4: Browser/manual checks**

If a browser is available:

- `/app/search`: big focused input appears, project context banner renders when `?project=` is present, “生成搜索计划” still appears for search mode.
- `/app/verify`: big focused input appears, no search-plan button appears.
- While loading: live timeline panel shows current action, stats, timeline, and stop button.
- Result: share bar appears above result body, existing result sections still render.

If browser automation is unavailable, do not claim visual screenshot verification. Report that only static/build verification was completed.

---

## Phase 2 Completion Criteria

Phase 2 is complete only when:

- `/app/search` and `/app/verify` use Apple-inspired `PageIntro`.
- `ResearchTool` input stage uses a large focused stage via `ResearchInputStage`.
- Search plan editor is wrapped in `EditableSearchPlanPanel`.
- Live progress uses `ResearchTimelinePanel` and stop button remains visible.
- Error handling still exposes retry when available.
- Results are wrapped in `ResearchResultShell` and show a share bar before existing result details.
- Search/verify API calls, queue polling, cancellation, feedback, backfill, shortlist, and outreach behavior are not removed.
- Tests, lint, TypeScript, and build pass.
