# Agent Execution Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a DINQ-inspired Agent Execution Layer to SignalHire search runs while preserving evidence-first candidate review.

**Architecture:** Keep persistence simple by storing execution-layer data inside `research_runs.progress` and final `result.agent_execution`. Add deterministic view-model builders in `web/lib/talent-profile.mjs`, have `web/lib/db.ts` seed the queued search strategy, have `worker/index.mjs` attach the completed execution layer, and render the new telemetry/clusters inside the existing Search Result Workspace.

**Tech Stack:** Next.js App Router, React, TypeScript declarations, Node ESM worker, InsForge `research_runs`, Node `node:test`.

---

### Task 1: Data Contract and Tests

**Files:**
- Modify: `web/lib/talent-profile.mjs`
- Modify: `web/lib/talent-profile.d.ts`
- Modify: `talent-profile.test.mjs`

- [ ] Add `buildAgentSearchStrategy` for deterministic channel/query fan-out.
- [ ] Add `buildAgentExecutionLayer` for completed results.
- [ ] Extend `buildSearchResultWorkspace` to expose execution telemetry, submitted candidates, trace preview, and delivery clusters.
- [ ] Add tests covering fan-out strategy, submission events, delivery clusters, and workspace telemetry.

### Task 2: API and Worker Integration

**Files:**
- Modify: `web/lib/db.ts`
- Modify: `worker/index.mjs`
- Modify: `worker/lib.mjs`
- Modify: `api-route-copy.test.mjs`

- [ ] Queue search runs with `progress.agent_execution.search_strategy`.
- [ ] Pass the strategy into the worker prompt as execution context.
- [ ] Update worker progress with strategy and trace data.
- [ ] Attach final `agent_execution` to the completed result before writing `research_runs`.
- [ ] Add source-level tests verifying queue and worker integration.

### Task 3: Workspace UI

**Files:**
- Modify: `web/components/result.tsx`

- [ ] Add compact execution telemetry metrics to `SearchResultWorkspaceView`.
- [ ] Add delivery cluster summary below the completion metrics.
- [ ] Add submitted status and source reason to candidate rows when available.
- [ ] Add execution trace preview in the folded Research Log.

### Task 4: Verification

**Commands:**
- `node --test talent-profile.test.mjs api-route-copy.test.mjs run-storage.test.mjs`
- `npm --prefix web run build`

- [ ] Run focused tests.
- [ ] Run production build.
- [ ] Spawn an independent validation agent with the PRD, plan, diff, and test output.
