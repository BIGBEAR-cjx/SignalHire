# Lessie-Inspired Recruiting Baseline

Date: 2026-06-30

## Already Present

- CandidateGraph builder: `web/lib/candidate-graph.mjs`
- Project-level candidate graph view: `web/lib/projects.ts`
- Autonomous sourcing panel: `web/app/app/projects/[id]/page.tsx`
- Contact profile and contactability score: `web/lib/contact-profile.mjs`
- Contact resolution result and send eligibility: `web/lib/contact-resolution.mjs`
- Hunter provider boundary: `web/lib/contact-providers.mjs`
- Single and bulk contact resolution routes: `web/app/api/contact-resolution/*`
- Gmail Outreach Sequence panel: `web/app/app/projects/[id]/page.tsx`
- Evidence-driven first email draft: `web/lib/outreach-draft.mjs`
- Shareable report surface: `web/app/r/[id]/page.tsx`
- Search workspace entry: `web/app/app/search/page.tsx`

## Gaps To Build

- Fast Lead Preview before deep research finishes.
- Direct `open_evidence_leads` input into preview.
- `Not relevant` preview feedback that becomes next-search constraints.
- Search workspace and Role Workspace preview rendering.
- Source mix labels, source tooltips, and readiness reasons that are easier to scan.
- GitHub / paper / company page source classification.
- Shareable shortlist report source mix reuse.
- Follow-up sequence editing with explicit 3-step workflow.
- Role-level `auto_follow_up_only` setting with 7-day follow-up default.
- Agency client-visible outreach activity digest.

## Guardrails

- Do not rebuild CandidateGraph.
- Do not add a generic people database.
- Do not add public SEO/free-tools pages in this phase.
- Do not auto-send first outreach.
- Do not show unverified leads as recommendations.
- Do not trigger contact provider calls from preview leads.
- Do not expose provider raw references, cost units, private notes, or error stacks in client-visible digest/report surfaces.
