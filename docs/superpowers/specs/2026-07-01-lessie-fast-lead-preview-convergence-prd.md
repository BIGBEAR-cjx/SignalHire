# PRD: Lessie Fast Lead Preview Convergence

## 1. Product Goal

Turn existing Fast Lead Preview into a more explicit review queue inside SignalHire: preview leads help users inspect direction while research is running, but they are visibly not recommendations and cannot trigger outreach until evidence is verified.

## 2. Current Baseline

Already present:
- `buildLeadPreviewView` reads candidate submission events and `open_evidence_leads`.
- `LeadPreviewPanel` renders unverified leads in Role Workspace.
- “Not relevant” feedback can become next-search constraints.
- Preview leads have `can_outreach: false`.

Remaining problem:
- The panel does not summarize how many leads came from profile leads vs evidence-like sources.
- The source mix of preview leads is implicit inside cards.
- The review queue does not have a compact “what to do next” summary for recruiters.

## 3. User Stories

1. As a recruiter, I can see how many unverified leads are available before the final shortlist.
2. As a recruiter, I can tell whether the preview pool is mostly profile leads or evidence-bearing public sources.
3. As a recruiter, I can mark bad preview leads as not relevant and use those constraints in the next search.
4. As an operator, I am not allowed to outreach from preview leads.

## 4. Functional Requirements

### P1 Preview Summary

Add `summary` to `LeadPreviewView`:

```ts
{
  item_count: number;
  profile_lead_count: number;
  evidence_source_count: number;
  source_type_counts: Array<{ source_type: string; count: number }>;
  can_outreach_count: number;
  blocked_outreach_reason: string;
}
```

### P1 Panel UX

- Render a compact summary row above preview cards.
- Show:
  - total preview leads
  - profile leads
  - evidence-like sources
  - outreach blocked state
- Keep the panel compact on mobile.
- Do not introduce nested cards beyond the existing individual lead cards.

### P1 Safety

- `can_outreach_count` must remain `0` for preview leads.
- UI must explicitly state outreach is disabled until evidence and contact provenance are verified.

## 5. Acceptance Criteria

- `lead-preview.test.mjs` covers summary counts, source type counts, and blocked outreach reason.
- `LeadPreviewPanel` statically references `view.summary`.
- Preview cards keep `data-can-outreach="false"` when unverified.
- Build passes after integration.

## 6. Out Of Scope

- Sending emails.
- Adding new lead providers.
- Persisting preview feedback beyond the existing next-search constraint path.
- Replacing final shortlist cards.

