# History Filtering And Lessie Role Workspace Convergence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining high-leverage planning and implementation work around History filtering P0/P1 plus Lessie P1/P2 Role Workspace experience polish without rebuilding capabilities already shipped.

**Architecture:** Keep the work as three bounded product increments. History filtering stays in `web/lib/history.mjs`, `web/lib/db.ts`, `/api/history`, and `/app/history`. Lead preview stays in `web/lib/lead-preview.mjs` and `web/components/LeadPreviewPanel.tsx`. Source mix polish stays in `web/lib/source-classifier.mjs` and `web/app/app/projects/[id]/page.tsx`.

**Tech Stack:** Next.js App Router, TypeScript/TSX, Node ESM helper modules, `node:test`, existing SignalHire UI primitives.

---

## Task Plan Table

| Priority | Task | Product Outcome | Primary PRD | Write Scope | Verification |
| --- | --- | --- | --- | --- | --- |
| P0 | History Filtering Completion | History becomes a reusable workbench for reopening role/search runs, not just a chronological list. Users can see active filters, remove filters safely, and understand why a run needs action. | `docs/superpowers/specs/2026-07-01-history-filtering-completion-prd.md` | `web/lib/history.mjs`, `web/app/app/history/page.tsx`, `history-filters.test.mjs` | `node --test history-filters.test.mjs`; static UI assertions |
| P1 | Fast Lead Preview Convergence | Lessie P1 preview leads become an explicit review queue with counts, source mix, and clear evidence/outreach gating. | `docs/superpowers/specs/2026-07-01-lessie-fast-lead-preview-convergence-prd.md` | `web/lib/lead-preview.mjs`, `web/lib/lead-preview.d.ts`, `web/lib/lead-preview.d.mts`, `web/components/LeadPreviewPanel.tsx`, `lead-preview.test.mjs` | `node --test lead-preview.test.mjs`; no outreach allowed for preview leads |
| P2 | Source Mix Role Workspace UX | Lessie P2 source mix becomes a readable evidence mix panel in Role Workspace, separating evidence-backed sources from profile leads. | `docs/superpowers/specs/2026-07-01-lessie-source-mix-role-workspace-prd.md` | `web/lib/source-classifier.mjs`, `web/lib/source-classifier.d.ts`, `web/components/result.tsx` if needed, `web/app/app/projects/[id]/page.tsx`, `source-classifier.test.mjs` | `node --test source-classifier.test.mjs`; static Role Workspace assertions |

## Execution Order

1. Write and commit PRD/plan documents.
2. Dispatch worker agents in parallel only after the write scopes are confirmed disjoint.
3. Main agent reviews subagent outputs, resolves integration conflicts, and runs the combined verification suite.
4. Dispatch three independent validation agents after integration:
   - Visual interaction validation: layout, controls, affordances, responsive risks.
   - User experience validation: workflow clarity, hiring/recruiting usefulness, copy.
   - Technical validation: data contracts, tests, regressions, overreach.
5. Main agent performs final verification and reports any residual gaps.

## Non-Goals

- Do not implement SEO or public free tools.
- Do not rebuild ATS, Smart Report, Sequence Analytics, or Network Referral Path.
- Do not add a new database table for History P0/P1.
- Do not enable outreach for unverified lead preview items.
- Do not scrape LinkedIn or build a full social graph.

## Coordination Notes

- Workers must not touch `docs/marketing/`; it is pre-existing untracked collateral.
- Workers must not revert changes from other agents.
- If multiple agents need `web/app/app/projects/[id]/page.tsx`, the main agent will integrate that file after worker proposals instead of allowing overlapping edits.
- The existing branch is `codex/history-lessie-workflow`.

