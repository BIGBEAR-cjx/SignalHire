# Profile Lead Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productize OpenJobs/Mira as a profile lead layer, not a database search or verified recommendation layer.

**Architecture:** Add a pure `profile-lead-layer` view builder over lead preview and candidate graph data, return it from project detail API, and update Role Workspace copy/source labels to frame provider rows as low-evidence profile leads that require verification before recommendation or outreach.

**Tech Stack:** Existing lead preview, candidate graph, OpenJobs provider, Next.js project workspace, Node test runner.

---

### Task 1: Core View Builder

**Files:**
- Create: `web/lib/profile-lead-layer.mjs`
- Create: `web/lib/profile-lead-layer.d.ts`
- Create: `web/lib/profile-lead-layer.d.mts`
- Test: `profile-lead-layer.test.mjs`

- [ ] Write failing tests for copy, lead counts, verified candidate count, and evidence verification next step.
- [ ] Run `node --test profile-lead-layer.test.mjs` and verify it fails because the module is missing.
- [ ] Implement `buildProfileLeadLayerView`.
- [ ] Run the test and verify it passes.

### Task 2: Product Wiring

**Files:**
- Modify: `web/app/api/projects/[id]/route.ts`
- Modify: `web/app/app/projects/[id]/page.tsx`
- Modify: `web/components/LeadPreviewPanel.tsx`
- Modify: `web/lib/source-classifier.mjs`
- Test: `api-route-copy.test.mjs`
- Test: `lead-preview.test.mjs`
- Test: `openjobs-provider.test.mjs`

- [ ] Add failing static tests asserting Role Workspace uses Profile Lead Layer copy, profile lead next action is evidence verification, and no database-search positioning is introduced.
- [ ] Return `profileLeadLayer` from project detail API.
- [ ] Render Profile Lead Layer copy next to OpenJobs/Mira controls.
- [ ] Update `people_api` label/tooltip to `Profile lead`.
- [ ] Run targeted tests and build.
