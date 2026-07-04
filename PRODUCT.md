# Product

## Register

product

## Users

SignalHire serves company HR teams, founders, recruiters, and agency operators who need to move from a role brief to credible candidates, contact actions, replies, and interview-ready handoffs without manually piecing together every source, profile, message, and inbox update.

Their context is operational and investigative at the same time. They need speed, but the output still has to be defensible: why this person matches, what evidence supports the claim, how reachable the person is, what message should go out, and what should happen next.

## Product Purpose

SignalHire is an AI recruiting workspace for role-based sourcing, evidence review, contact preparation, controlled outreach, inbox triage, and candidate delivery.

It expands a natural-language hiring brief into a role-aware search plan, searches public signals and profile leads, builds a candidate graph with source mix and evidence quality, previews unverified leads while research is running, resolves contact profiles when available, drafts evidence-based outreach sequences, classifies replies, and packages progress into recruiter- or client-ready reports.

Success means a recruiter can move a role forward from brief to shortlist to contact to reply to interview-ready review while still seeing the evidence trail, source provenance, contact confidence, blocked reasons, and next action for each candidate.

## Current Product Version

SignalHire's current product is no longer only a one-shot talent search result. It is a role workspace with these product surfaces:

1. Role-aware sourcing: JD or natural-language intake turns into role category, must-have and nice-to-have criteria, exclusions, source strategy, and query clusters.
2. Fast lead preview: unverified leads can appear while research is running, with outreach blocked until evidence and contact provenance are reviewed.
3. CandidateGraph and source mix: candidates are merged across public evidence, profile leads, LinkedIn URL seeds, internal resume/manual upload paths, and contact profiles; source mix is treated as a recruiting judgment surface.
4. Contact resolution: contact profiles include email, phone, LinkedIn URL, source, confidence, deliverability, resolution metadata, and contactability scoring.
5. Outreach sequence workspace: candidates can carry a 3-step sequence with evidence refs, editable subject/body, per-step review history, blocked reasons, and Gmail actions.
6. Inbox agent: SignalHire classifies replies into interested, ask for details, later, not interested, bounced, out of office, and needs human reply, then suggests the next action.
7. Scheduling support: interested candidates can produce scheduling drafts using available calendar slots when connected, hold a selected slot in SignalHire state, track candidate/manager time negotiation states, create, reschedule, or cancel a Google Calendar interview event with attendee updates when event access is connected, and write back confirmed/rescheduled/canceled interview state for delivery reporting.
8. Role Agent controls, why-now signals, outreach autopilot path, and inbox-to-interview queue: role-level status, capacity goals, approval mode, digest preference, next tasks, `run_sourcing` direct manual search-task execution, backend RoleAgentRun execution for sourcing and live-signal refresh, `resolve_contacts` direct bulk contact resolution, `approve_or_send_outreach` direct ready-draft approval without sending, `retry_failed_outreach` direct failed-send retry, `follow_up` direct Gmail draft saving without sending, `review_interested_candidates` direct first inbox next-step application, `refresh_live_signals` stale/expired signal refresh queue with scheduled provider cron and provider guardrail fallback, next-action execution states, execution log with targets/results/failed items/retryability, persisted role-agent run manifests with run_id/workflow_step/status/guardrails, blocked automation reasons, activity history, `why_now` candidate ranking with contact timing windows, live signal contract with type/source/confidence/freshness/expires_at, expired-signal downranking, live signal ingestion from CandidateGraph evidence/profile/company-open-role/tech-stack context, contact/outreach recovery stages, unified autopilot workflow preview/run plan with target preview and guardrails, persisted recovery history, latest execution summary, retryable failed item display, interested queue, interview-ready queue with scheduling state, candidate/manager negotiation state, two-sided message history, inbox-to-interview activity timeline, slot-held/confirmed/rescheduled/canceled writeback, Google Calendar event lifecycle actions, handoff/calendar/recovery state, inbox next steps, and Role Agent-to-Inbox action bridge make the role feel like a managed pipeline.
9. Delivery layer: Smart Report, token-gated and invited-customer-account shareable client delivery loop, project-level delivery snapshot injection, client delivery weekly progress, report-version frozen delivery snapshot manifest, shareable delivery version history, weekly delivery archive manifest grouped from persisted report versions, independent weekly delivery archive storage/readback, Client Delivery Audit Center with CSV export, Role Agent client delivery loop metrics/risks/next steps including confirmed interviews, client-safe delivery filtering, client-visible report field controls, customer account access controls, shareable report view metrics, manager feedback capture, retained feedback audit history, metrics-derived and persisted client delivery audit trail, independent client delivery audit event storage, referral path summaries, ATS-lite export, History filters, saved views, and project pools turn research and outreach into reusable recruiting memory.

## Brand Personality

Trustworthy, evidence-driven, direct, and execution-oriented.

SignalHire should feel calm enough for repeated recruiting work, sharp enough to make judgment calls, and active enough to reduce the user's manual workload. Users should feel that the product is doing the work behind the scenes, but can still inspect why each action is recommended.

## Anti-references

SignalHire should not look or behave like a traditional resume database, ATS back office, generic purple-blue SaaS template, or complex BI dashboard.

Avoid broad lists of names without reasoning, decorative metrics without candidate action, evidence-light recommendations, and admin-heavy screens that slow down role progress. The product can learn from aggressive GTM automation tools, but the recruiting experience should stay candidate-, role-, and outcome-centered.

## Design Principles

1. Lead with useful action, backed by evidence. Candidate lists earn trust through sources, claims, contactability, and next steps, not through showing the most names.
2. Make the role state obvious. Recruiters should know what has been sourced, what is blocked, what needs review, and what will move the role closer to replies or interviews.
3. Turn signals into timing. Hiring spikes, source freshness, candidate activity, reply status, and contact confidence should become a clear "why now" and "what next".
4. Preserve recruiting momentum. The interface should help users move from brief to shortlist to outreach to reply to scheduling without re-organizing the same information.
5. Treat uncertainty as product value. Weak evidence, missing contact provenance, contradictory claims, and unclear replies should be surfaced as useful decision points.
6. Prefer controlled automation over passive dashboards. When automation can save work and improve the user experience, it should be productized with visible state, recovery paths, and auditability.

## Product Direction

The next product direction is to absorb the best parts of agentic GTM tools without turning SignalHire into a generic outbound platform:

- One prompt should create a running role agent, not just a search result.
- Live lead and candidate signals should decide who deserves attention now.
- Contact enrichment, outreach, follow-up, inbox triage, and scheduling should feel like one pipeline.
- Recruiters should see concrete next actions before they read long evidence packets.
- Client-facing delivery should show progress, source quality, risks, outreach state, and interview-ready candidates in one view.

## Accessibility & Inclusion

Target WCAG AA for core flows. Support reduced-motion preferences, keep contrast strong for dense evidence reading, avoid communicating claim status by color alone, and ensure source links, badges, controls, reports, and automation states remain understandable to keyboard and screen-reader users.
