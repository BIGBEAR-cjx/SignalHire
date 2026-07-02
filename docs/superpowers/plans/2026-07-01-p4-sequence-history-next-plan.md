# P4 Agent Control, Sequence Step Review, And History Saved Views Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the remaining backlog into shippable workflow controls: persistent Role Agent controls, per-step sequence editing/approval history, and History facet counts plus saved views.

**Architecture:** Keep this phase schema-light and evidence-first. Persist P4 control settings in the existing `projects.outreach_settings` JSON, persist per-step sequence state inside existing `outreach_threads.sequence_messages`, and implement History saved views as client-local presets while facet counts are returned by `/api/history` from existing run result payloads.

**Tech Stack:** Next.js App Router, TypeScript/TSX, Node ESM helper modules, `node:test`, existing SignalHire UI primitives.

---

## Task Plan Table

| Priority | Task | Product Outcome | Primary PRD | Write Scope | Verification |
| --- | --- | --- | --- | --- | --- |
| P0 | P4 Persistent Role Agent Controls | Recruiters can persist role-agent capacity targets, mode, pause/resume status, and digest preference without enabling unsafe auto-send. | `docs/superpowers/specs/2026-07-01-p4-persistent-role-agent-control-prd.md` | `web/lib/outreach-settings.mjs`, `web/lib/role-agent-guardrails.mjs`, project outreach settings API/types, focused tests. | Guardrail/settings tests prove persistence shape, pause/resume state, capacity labels, and `auto_high_confidence` remains blocked. |
| P1 | Sequence Step Edit And Approval History | Recruiters can edit each sequence step independently and see approval/review history for the step instead of only editing the first draft. | `docs/superpowers/specs/2026-07-01-sequence-step-edit-approval-history-prd.md` | `web/lib/outreach-sequence-workspace.mjs`, `web/lib/outreach-threads.mjs`, Role Workspace integration, focused tests. | Sequence tests prove step patching preserves first-send manual guard and appends audit events. |
| P2 | History Facet Counts And Saved Views | History becomes a reusable management surface with visible facet counts and local saved views for recurring filters. | `docs/superpowers/specs/2026-07-01-history-facet-counts-saved-views-prd.md` | `web/lib/history.mjs`, `/api/history`, `/app/history`, focused tests. | History tests prove facet counts, saved view serialization, URL filters, and no DB schema addition. |

## Execution Checklist

- [ ] Write detailed PRD for P4 Persistent Role Agent Controls.
- [ ] Write detailed PRD for Sequence Step Edit And Approval History.
- [ ] Write detailed PRD for History Facet Counts And Saved Views.
- [ ] Dispatch implementation agents with disjoint write scopes.
- [ ] Main agent integrates shared Role Workspace UI.
- [ ] Run focused unit/static verification.
- [ ] Dispatch independent visual interaction validation agent.
- [ ] Dispatch independent user experience validation agent.
- [ ] Dispatch independent technical validation agent.
- [ ] Fix validation findings and rerun verification.

## Agent Ownership

| Agent | Ownership | Must Avoid |
| --- | --- | --- |
| Worker A | P4 persistent settings helper/API/tests. | Do not edit History files. Do not enable first-email or high-confidence auto-send. Avoid Role Workspace page edits unless asked by main. |
| Worker B | Sequence step patch/audit helper/tests. | Do not edit History. Do not create a new DB table. Avoid Role Workspace page edits unless asked by main. |
| Worker C | History facet counts/saved-view helper and History page/API tests. | Do not edit Role Workspace or outreach settings. Do not add server-side saved-view persistence. |
| Main Agent | PRDs, shared page integration, validation orchestration, final verification. | Do not stage `docs/marketing/`. |

## Non-Goals

- No production login-state manual smoke test.
- No new database table.
- No automatic first-email sending.
- No `auto_high_confidence` enablement.
- No new background scheduler beyond existing cron surfaces.
- No server-side saved views until users explicitly need cross-device persistence.
