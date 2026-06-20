# Internet Role-Aware Search Strategy Implementation Plan

## Summary

Implement a full role-aware sourcing layer for SignalHire. The work extends the existing talent-profile utilities, worker prompt, open-evidence precheck, and intake UI without adding new database tables.

## Implementation

- Add `INTERNET_ROLE_TAXONOMY`, `detectInternetRoleCategory`, and `buildInternetRoleSearchPlaybook` in `web/lib/talent-profile.mjs`.
- Extend search intake parsing to clean pasted JD noise and split role title, employer context, candidate requirements, nice-to-have criteria, and exclusions.
- Replace fixed AI-centric agent strategy with role-aware channels, query clusters, score dimensions, and aggressive public-web recall metadata.
- Update prompt construction in `web/lib/miro.ts` and `worker/lib.mjs` to remove global AI-only directions and require role-aware candidate clusters, source mix, top candidates, and next search recommendations.
- Update `worker/open-evidence-sources.mjs` so precheck queries use the role-aware search strategy when available and allow public LinkedIn/social leads while rejecting private contact guessing.
- Surface role category, employer context, and channel plan in the search intake panel.
- Extend `web/lib/talent-profile.d.ts` with role-aware public types.

## Verification

- Add tests for all 12 role categories and role-specific playbooks.
- Add tests for AI Growth/Marketing source strategy and JD cleaning.
- Add prompt tests proving `AI DIRECTIONS` is removed and role metadata is included.
- Add open-evidence tests proving public LinkedIn/social recall is allowed and private-contact guessing is blocked.
- Run:
  - `node --test talent-profile.test.mjs`
  - `node --test talent-profile.test.mjs api-route-copy.test.mjs run-storage.test.mjs`
  - `npm --prefix web run build`

## Independent Acceptance

Use an independent test agent to review the implementation against the PRD with four role briefs:

- AI Growth/Marketing
- Full-stack Engineer
- Product Manager
- UX/Product Designer

The agent must check category detection, JD parsing, role-specific channels, prompt neutrality, public-source boundary, and UI surface coverage, then report `pass` or `needs_fix`.
