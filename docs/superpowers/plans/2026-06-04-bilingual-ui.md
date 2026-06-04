# Bilingual UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Chinese / English language switch across SignalHire's core UI.

**Architecture:** Store copy in a flat `zh/en` dictionary exposed by `web/lib/i18n.mjs`. Use a client `LanguageProvider` to persist the selected locale in `localStorage`, update `<html lang>`, and provide `t(key)` to React components.

**Tech Stack:** Next.js App Router, React context, plain Node tests, TypeScript declaration file for the `.mjs` dictionary.

---

### Task 1: Dictionary Core

**Files:**
- Create: `i18n.test.mjs`
- Create: `web/lib/i18n.mjs`
- Create: `web/lib/i18n.d.ts`

- [x] **Step 1: Write failing tests**

Run: `node --test i18n.test.mjs`

Expected: fails with `ERR_MODULE_NOT_FOUND` because `web/lib/i18n.mjs` does not exist yet.

- [ ] **Step 2: Implement dictionary helpers**

Create `SUPPORTED_LOCALES`, `normalizeLocale`, `isLocale`, and `t`.

- [ ] **Step 3: Run tests**

Run: `node --test i18n.test.mjs`

Expected: all tests pass.

### Task 2: React Provider

**Files:**
- Create: `web/components/LanguageProvider.tsx`
- Create: `web/components/LanguageSwitcher.tsx`
- Modify: `web/app/layout.tsx`

- [ ] **Step 1: Add provider**

Wrap the root body children with `LanguageProvider`.

- [ ] **Step 2: Add switcher**

Expose compact segmented `中文 / English` controls for landing and app shell.

### Task 3: Core UI Copy

**Files:**
- Modify: `web/app/Landing.tsx`
- Modify: `web/app/login/page.tsx`
- Modify: `web/app/register/page.tsx`
- Modify: `web/app/app/layout.tsx`
- Modify: `web/app/app/page.tsx`
- Modify: `web/app/app/search/page.tsx`
- Modify: `web/app/app/verify/page.tsx`
- Modify: `web/app/app/projects/page.tsx`
- Modify: `web/app/app/shortlist/page.tsx`
- Modify: `web/app/app/history/page.tsx`
- Modify: `web/app/app/settings/page.tsx`
- Modify: `web/components/ResearchTool.tsx`
- Modify: `web/components/result.tsx`
- Modify: `web/components/research-workspace.tsx`

- [ ] **Step 1: Replace fixed UI labels**

Use `const { t, locale } = useI18n()` in client components and replace user-facing fixed copy.

- [ ] **Step 2: Preserve dynamic content**

Leave candidate names, project briefs, search queries, evidence notes, and stored summaries unchanged.

### Task 4: Backend Language Hint

**Files:**
- Modify: `web/components/ResearchTool.tsx`
- Modify: `web/app/api/search/route.ts`
- Modify: `web/app/api/verify/route.ts`

- [ ] **Step 1: Send locale**

Include `locale` in search / verify request bodies.

- [ ] **Step 2: Prompt by locale**

Ask generated reports to match the selected UI language.

### Task 5: Verification

**Files:**
- Existing verification commands only.

- [ ] **Step 1: Run targeted tests**

Run: `node --test i18n.test.mjs auth-session-sync.test.mjs search-page-state.test.mjs research-progress.test.mjs`

- [ ] **Step 2: Run type check**

Run in `web`: `./node_modules/.bin/tsc --noEmit`

- [ ] **Step 3: Run build**

Run in `web`: `npm run build`
