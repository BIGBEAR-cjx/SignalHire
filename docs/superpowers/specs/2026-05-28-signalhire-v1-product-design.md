# SignalHire v1 Product Design

Date: 2026-05-28

## Product Positioning

SignalHire v1 is a global AI talent search and evidence delivery platform for company HR teams and headhunters.

The product starts from a hiring brief, searches broad public sources for AI talent signals, returns a small high-quality shortlist, and packages the evidence into a shareable report. It is no longer constrained by hackathon demo requirements.

Core promise:

> Find 10-15 globally relevant AI candidates with evidence-backed signals from papers, open source, product practice, work history, and public profiles.

SignalHire should not compete as a generic people database. Its differentiation is broad public-source coverage, cross-verification, explainable scoring, and report-quality delivery.

## Primary User

The v1 user is either:

- A headhunter preparing a client-facing AI candidate shortlist.
- A company HR or talent partner sourcing candidates for an AI role and sharing findings with a hiring manager.

v1 serves both, but prioritizes report/share/export delivery quality over high-volume CRM workflow.

## Primary Workflow

1. User enters a hiring brief in natural language.
2. SignalHire parses the brief into a structured search profile.
3. SignalHire searches broad public sources for candidate signals.
4. SignalHire extracts candidates and evidence.
5. SignalHire cross-verifies papers, open-source work, product practice, work history, and profile identity.
6. SignalHire groups candidates by AI talent direction.
7. SignalHire returns a 10-15 person shortlist.
8. User reviews candidates, removes weak fits, opens candidate profiles, and shares a web report.

## v1 Product Scope

### P0

- Search Brief input and parsing.
- AI talent direction grouping.
- 10-15 high-quality candidate shortlist.
- Explainable match score.
- Candidate cards with strongest signals and evidence quality.
- Candidate Profile with Evidence Audit.
- Shortlist save/remove behavior.
- Shareable web report link.
- Public-source evidence and cross-verification.
- Optional display of public contact/profile links.

### P1

- PDF export.
- CSV or Excel export.
- Whole-shortlist evidence audit summary.
- Paid or authorized enrichment integrations.
- Saved search alerts.
- Outreach opener generation.
- Team collaboration.
- ATS or CRM integrations.

## Non-Goals for v1

- Do not build a high-volume people CRM.
- Do not make outreach automation the core product.
- Do not infer or guess private email addresses.
- Do not let paid enrichment sources become the only evidence for a match.
- Do not preserve the old "Verify candidate" tab as a primary product entry.
- Do not optimize for hackathon demo constraints or pre-cached-only flows.

## Search Brief

The main entry point is a hiring brief, not a Boolean query builder.

Example:

> Find senior engineers with LLM inference or serving experience, ideally with vLLM, Triton, TensorRT-LLM, Kubernetes, or distributed systems work. North America or Europe preferred, remote acceptable.

The parsed brief should include:

- Target AI direction.
- Required and preferred skills.
- Seniority.
- Geography or remote constraints.
- Evidence preferences.
- Exclusion criteria.
- Adjacent talent pools worth exploring.

The parsed brief should be visible and editable enough for the user to understand what the system is searching for.

## AI Talent Directions

Search results are grouped by AI direction. The grouping helps users understand the talent market while still producing a shortlist.

Initial direction taxonomy:

- AI Infrastructure / LLM Systems
- AI Research / Applied Science
- Applied AI / Agents
- ML Platform / MLOps
- Data / Evaluation / Safety
- AI Product / Solutions
- Founder / Builder

Each search should identify:

- Primary matching direction.
- Adjacent transferable directions.
- High-potential candidate sources.

The final 10-15 candidates do not need to be evenly distributed across directions. Distribution should follow the brief.

## Search Result Delivery

v1 results should feel like a hiring shortlist, not raw search results.

Each candidate card should show:

- Name.
- Current role and company when available.
- Location or region when publicly available.
- AI direction tags.
- Match score.
- Strongest signals.
- Evidence quality.
- Main uncertainty or risk.
- Public profile/contact links when available.
- Add/remove shortlist action.
- Link to Candidate Profile.

The default result volume is 10-15 candidates. This keeps review cost low and supports high-confidence delivery.

## Match Score

The score is composite and explainable. The default weight favors real-world achievement signals over resume keywords.

Suggested v1 weighting:

- Real achievement signals: 40%
- Hiring brief skill match: 25%
- Work history relevance: 20%
- Evidence quality: 15%

Real achievement signals include papers, accepted conference work, open-source contributions, Hugging Face models or datasets, shipped projects, technical writing, benchmark participation, demos, and public product work.

Every score should include a short explanation:

- Why this candidate matched.
- Which signals drove the score.
- Which evidence is strong.
- Which claims remain uncertain.

## Candidate Profile

Candidate Profile is the deep-dive page for a single person.

It should include:

- Candidate summary.
- Direction and skill tags.
- Why the candidate matches the brief.
- Paper and research signals.
- Open-source and engineering practice signals.
- Product or applied work signals.
- Work history signals.
- Public profile links.
- Public contact links when clearly available.
- Evidence Audit.
- Suggested outreach angle.

The page should be useful as an internal reviewer page and as source material for a client-facing report.

## Evidence Audit

The old standalone "Verify candidate" mode becomes a Candidate Profile action, not a top-level product entry.

v1 uses the entry and language:

- Candidate Profile contains "Evidence Audit" or "Verify Evidence".
- The audit is candidate-level in P0.
- Whole-shortlist audit summary is P1.

Evidence Audit should answer:

- Which important claims are verified?
- Which claims are unverified?
- Which claims are contradicted?
- Which conclusions rely on only one source?
- Is there a possible identity mismatch?
- Is the public profile recent enough?
- Are the strongest signals relevant to the hiring brief?

## Data Source Strategy

P0 uses public, verifiable sources. P1 may add paid or authorized enrichment.

Public-source categories:

- Papers and research: arXiv, OpenReview, Semantic Scholar, Google Scholar, conference pages, lab pages.
- Open source and engineering: GitHub, Hugging Face, Papers with Code, project pages, benchmark pages, release notes, issue and PR activity.
- Product and practice: demos, technical blogs, company engineering blogs, launch posts, documentation, talks, slides, case studies.
- Work history: LinkedIn when publicly visible, company team pages, personal sites, news, podcasts, interviews.
- Community and influence: X/Twitter, YouTube, Substack, Medium, Hacker News, conference speaker bios.
- Identity signals: personal domains, Scholar profiles, GitHub profiles, ORCID, company pages, conference bios.

Evidence rules:

- Key conclusions need source URLs.
- Strong claims should be cross-verified across independent sources when possible.
- Paid or authorized enrichment can supplement, but cannot be the only support for a candidate match.
- Unverified or weak evidence must be labeled as such.
- Search-result URLs are not evidence.

## Contact Information

v1 displays public contact and profile links when available:

- Personal website.
- LinkedIn.
- GitHub.
- Google Scholar.
- Hugging Face.
- X/Twitter.
- Public email only when clearly published by the candidate or affiliated page.

v1 should not guess private email addresses.

## Shareable Client Report

P0 delivery is a web share link.

The share report should include:

- Hiring brief summary.
- Search strategy summary.
- AI direction distribution.
- Shortlist candidates.
- Candidate-level match explanations.
- Evidence summaries.
- Known uncertainties.

P1 adds PDF and CSV/Excel exports.

## Existing Product Migration

The current Search mode maps to the new Search Brief and Shortlist workflow.

The current Verify mode should be removed from the main navigation or de-emphasized. Its functionality becomes Candidate Profile Evidence Audit.

The existing `/r/[id]` report concept can evolve into shareable candidate and shortlist reports.

The existing worker queue remains useful because deeper public-source search will still be long-running.

## Success Criteria

v1 is successful when a user can:

- Enter one AI hiring brief.
- Receive 10-15 plausible global AI candidates.
- Understand why each candidate matched.
- See evidence across multiple source types.
- Identify uncertainty or risk before sharing.
- Save or remove candidates from a shortlist.
- Share a web report with a hiring manager or client.

The result should feel closer to a consultant-quality shortlist than a raw search dump.

## Open Implementation Questions

These should be resolved during implementation planning:

- Whether Search Brief parsing should be deterministic schema extraction, LLM-only extraction, or hybrid.
- Whether candidate and source records need separate tables before the first v1 implementation.
- Whether the first shortlist report should be one `research_runs` result payload or a new project-oriented data model.
- How to cache source-level evidence so reruns are cheaper.
- Which AI direction taxonomy should be user-editable in the first release.
