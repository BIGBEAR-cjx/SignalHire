# Outreach Sequence, History P2, And Role Agent Guardrails Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the next differentiated recruiting workflow layer after the Juicebox/Lessie iteration: sequence workflow, deeper history reuse, and a cautious autonomous recruiter foundation.

**Assumptions:**

- SignalHire should stay evidence-first. Profile leads can start workflow, but strong actions require verified evidence and contact provenance.
- Outreach automation must stay approval-led. This phase may allow `auto_follow_up_only` visibility, but must not auto-send first emails or add high-confidence auto-send.
- Existing P3/P4 primitives should be reused: `buildEvidenceDrivenOutreachSequence`, role outreach settings, sequence analytics, follow-up drafts, and agency activity digest.
- History P2 should derive from existing research result payloads first. Do not add a database table only for filtering.

**Success Criteria:**

- Recruiters can see outreach sequence state as a workflow, not only a single email draft.
- History can filter runs by evidence quality, needs action, gap type, and whether a run has outreach drafts.
- Role Workspace has a cautious Role Agent guardrail view that explains approval mode, capacity pressure, next tasks, and blocked automation.
- Visual, UX, and technical validation agents can independently approve the scope without finding auto-send or product-boundary regressions.

---

## Task Plan Table

| Priority | Task | Product Outcome | Primary PRD | Write Scope | Verification |
| --- | --- | --- | --- | --- | --- |
| P0 | Lessie P3 Outreach Sequence Workspace | External outreach becomes a sequence workflow with per-step state, evidence refs, contact gating, and next action clarity. | `docs/superpowers/specs/2026-07-01-lessie-p3-outreach-sequence-workspace-prd.md` | New pure sequence workspace helper, outreach panel integration, focused tests. | Sequence workspace unit tests; project page static assertions; no first-email auto-send. |
| P1 | History P2 Evidence-First Filtering | History becomes a reusable recruiting memory surface: filter by evidence quality, gap type, needs action, and outreach draft readiness. | `docs/superpowers/specs/2026-07-01-history-p2-evidence-filtering-prd.md` | `web/lib/history.mjs`, `web/app/app/history/page.tsx`, `history-filters.test.mjs`. | `node --test history-filters.test.mjs`; active chips and URL params work. |
| P2 | Autonomous Recruiter P4 Guardrails | Role Agent is productized as a controlled operating layer: capacity, pause/resume state, activity log, allowed/blocked automation. | `docs/superpowers/specs/2026-07-01-autonomous-p4-role-agent-guardrails-prd.md` | New guardrail helper, focused tests, compact Role Workspace panel. | Guardrail unit tests; copy asserts manual-first and no `auto_high_confidence` enablement. |

## Execution Checklist

- [ ] Write detailed PRD for Outreach Sequence Workspace.
- [ ] Write detailed PRD for History P2 Evidence-First Filtering.
- [ ] Write detailed PRD for Autonomous Recruiter P4 Guardrails.
- [ ] Dispatch implementation agents with disjoint write scopes.
- [ ] Main agent integrates shared Role Workspace UI.
- [ ] Run unit/static verification.
- [ ] Dispatch independent visual interaction validation agent.
- [ ] Dispatch independent user experience validation agent.
- [ ] Dispatch independent technical validation agent.
- [ ] Fix any P0/P1 validation findings and rerun verification.

## Agent Ownership

| Agent | Ownership | Must Avoid |
| --- | --- | --- |
| Worker A | Outreach sequence workspace helper and tests. May propose Role Workspace integration notes. | Do not edit History files. Do not enable auto-send. |
| Worker B | History P2 evidence filters and tests. | Do not edit Role Workspace. Do not add DB tables. |
| Worker C | Role Agent guardrails helper and tests. | Do not edit History. Do not implement `auto_high_confidence`. |
| Main Agent | PRDs, shared page integration, final tests, code review, validation orchestration. | Do not stage `docs/marketing/`. |

## Non-Goals

- No new contact provider.
- No LinkedIn scraping or social graph rebuild.
- No ATS integration expansion.
- No automatic first email sending.
- No automatic high-confidence contact send mode.
- No public share page work in this phase.
