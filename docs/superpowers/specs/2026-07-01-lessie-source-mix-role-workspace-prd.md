# PRD: Lessie Source Mix Role Workspace UX

## 1. Product Goal

Make Role Workspace source mix readable as a recruiting judgment surface. Users should see whether a role has enough evidence-backed sources, where profile leads are only leads, and what verification step comes next.

## 2. Current Baseline

Already present:
- `candidate-graph.mjs` builds `source_mix`.
- `source-classifier.mjs` classifies GitHub, paper, company page, personal site, profile lead, LinkedIn seed, public web, internal resume, and manual upload.
- `AutonomousSourcingPanel` renders source mix and candidate readiness in Role Workspace.
- Profile Lead Layer copy exists.

Remaining problem:
- Source mix is currently a count list, not a decision aid.
- It does not explicitly summarize evidence-backed vs lead-only sources.
- Candidate readiness chips exist, but the panel does not tell users the next verification priority.

## 3. User Stories

1. As a recruiter, I can see whether the role has evidence-backed source coverage.
2. As a recruiter, I can distinguish profile leads from sources that can support a recommendation.
3. As a recruiter, I get a short next-step recommendation based on source mix.
4. As a hiring manager-facing operator, I can trust that profile leads are not presented as verified evidence.

## 4. Functional Requirements

### P2 Source Mix UX Helper

Add helper to `source-classifier.mjs`:

```ts
buildSourceMixUxView(sourceMix, { locale })
```

Return:

```ts
{
  evidence_source_count: number;
  lead_source_count: number;
  total_source_count: number;
  evidence_types: string[];
  lead_types: string[];
  status_label: string;
  next_step: string;
}
```

Evidence-backed source types:
- `github`
- `paper`
- `company_page`
- `personal_site`
- `internal_resume`
- `manual_upload`
- `public_web`

Lead-only source types:
- `people_api`
- `linkedin_seed`

### P2 Role Workspace UI

- Source mix panel should show:
  - evidence-backed source count
  - lead-only source count
  - short status label
  - next-step recommendation
- Existing source rows with labels/tooltips remain.
- Profile leads keep Profile Lead Layer language.

## 5. Acceptance Criteria

- `source-classifier.test.mjs` covers evidence vs lead-only source grouping and next-step copy.
- Role Workspace statically references `buildSourceMixUxView`.
- UI copy does not call profile leads “database search”.
- Build passes after integration.

## 6. Out Of Scope

- Rewriting candidate graph.
- Adding new providers.
- Full source graph visualization.
- Any LinkedIn scraping.

