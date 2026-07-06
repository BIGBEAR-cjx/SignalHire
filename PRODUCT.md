# SignalHire Product

Updated: 2026-07-06

## One-line Description

SignalHire is an evidence-first AI recruiting workspace that turns a role brief into a reviewable shortlist, source-backed candidate judgment, controlled outreach, reply handling, and client-ready delivery.

## Product Purpose

Recruiting teams often lose time stitching together the same pieces by hand: role requirements, public candidate signals, source links, contact information, outreach drafts, inbox replies, scheduling state, and client updates.

SignalHire turns that fragmented work into one role workspace. A recruiter can start with a JD or natural-language brief, inspect why candidates match, see which evidence supports each claim, understand what is still uncertain, prepare contact and outreach, handle replies, and package progress for a hiring manager or client.

Success means a user can move a role from brief to credible shortlist to contact actions to interview-ready review while preserving evidence, source provenance, contact confidence, blocked reasons, and next actions.

## Target Users

| User | Job to be done | SignalHire value |
| --- | --- | --- |
| Company HR / Talent team | Source and screen candidates for specialized roles without losing evidence quality | Faster shortlist creation with public evidence, risks, contact readiness, and reusable project memory |
| Founder / Hiring manager | Understand who is worth interviewing and why | Candidate recommendations that explain fit, proof, uncertainty, and next interview questions |
| Recruiter / Boutique agency | Deliver credible progress to clients, not static name lists | Evidence-backed reports, outreach state, interview-ready queues, client-safe delivery summaries, and feedback history |
| Recruiting operator | Run a role continuously without trusting a black-box automation tool | Role goals, next actions, guardrails, audit trails, and manual recovery paths |

## What SignalHire Does Today

### 1. Role-aware sourcing

SignalHire parses a JD or natural-language brief into role category, employer context, must-have criteria, nice-to-have criteria, exclusions, source strategy, and query clusters. The strategy layer covers common internet roles such as software engineering, AI/ML/Data, product, design, growth, sales, customer success, security/DevOps, operations, and leadership roles.

### 2. Evidence-first shortlist

Candidate results include match reasons, strongest and weakest evidence, public source links, claim verdicts, evidence coverage, and risks that still need human review. SignalHire is designed to avoid treating a single self-claimed profile as a verified recommendation.

### 3. Lead preview and CandidateGraph

While live research is running, SignalHire can show unverified lead previews so users can judge direction early. Successful searches build candidate profiles and evidence sources, then merge public evidence, profile leads, LinkedIn URL seeds, internal resume/manual upload paths, contact profiles, source mix, dedupe signals, and readiness into a CandidateGraph-style review surface.

### 4. Contact and outreach workflow

When providers are configured, SignalHire can resolve contact profiles with source, confidence, deliverability, resolution metadata, and contactability scoring. It supports 3-step evidence-based outreach sequences, editable drafts, per-step review history, Gmail draft/send actions, follow-up drafts, failed-send retry, and sequence analytics.

### 5. Inbox-to-interview workflow

With Gmail and Calendar connected, SignalHire can classify replies such as interested, ask for details, later, not interested, bounced, out of office, and needs human reply. Interested candidates can move into scheduling packets, availability drafts, slot hold, Google Calendar event lifecycle actions, and confirmed/rescheduled/canceled interview writeback.

### 6. Role Agent workspace

The project workspace now acts like a controlled role agent. It tracks role status, capacity goals, health, blocked reasons, next actions, why-now signals, contact timing windows, execution logs, recovery history, retryable failed items, sourcing/contact/outreach/inbox actions, and stale live-signal refresh queues.

The current product favors visible automation over blind automation: users can see what the system is trying to do, why an action is blocked, what was executed, and how to recover.

### 7. Client delivery loop

SignalHire packages recruiting work into Smart Reports, token-gated or customer-account delivery views, client-safe summaries, weekly progress, interview-ready candidates, report-version history, delivery archive manifests, feedback capture, client delivery audit trails, and CSV-exportable audit views.

## Current Workflow

| Stage | Output |
| --- | --- |
| Brief intake | Role category, requirements, exclusions, channel plan, query clusters |
| Open-evidence preview | Early unverified leads and source summaries |
| Deep research | Candidate shortlist, evidence graph, source mix, execution trace |
| Candidate review | Match explanation, claim verdicts, risk notes, profile readiness |
| Contact preparation | Contact profile, confidence, deliverability, contactability |
| Outreach | Evidence-based sequence, draft review, Gmail draft/send, follow-up |
| Inbox handling | Reply classification, next action, scheduling or human-review queue |
| Delivery | Smart Report, client delivery summary, report versions, feedback and audit history |

## Product Boundaries

SignalHire is not:

- A traditional resume database.
- A generic ATS back office.
- A mass cold-email blasting tool.
- A black-box candidate recommender with no source trail.
- A tool that invents contact details or treats weak evidence as verified truth.

Important current boundaries:

- Preview leads and profile leads are discovery signals until reviewed.
- Contact enrichment, Gmail, Calendar, Greenhouse, and external live-signal features depend on provider configuration.
- Ready outreach approval is deliberately controlled; first-touch email sending is not treated as a blind autopilot action.
- External live-signal ingestion exists as a hook and fallback path, but production-quality live refresh depends on a configured provider.
- Full unattended recruiting autopilot remains a roadmap direction; current automation emphasizes visible state, guardrails, recovery, and auditability.

## Brand Personality

SignalHire should feel trustworthy, evidence-driven, direct, and execution-oriented.

The interface should be calm enough for repeated recruiting work, sharp enough for candidate judgment, and active enough to reduce manual workload. Users should feel that SignalHire is doing useful work behind the scenes while keeping the reasoning inspectable.

## Design Principles

1. Lead with useful action, backed by evidence.
2. Make the role state obvious: sourced, blocked, needs review, ready to contact, replied, interview-ready.
3. Turn signals into timing: freshness, reply state, contactability, company activity, and source quality should produce a clear "why now".
4. Preserve recruiting momentum from brief to shortlist to outreach to reply to scheduling.
5. Treat uncertainty as product value by surfacing weak evidence, missing provenance, contradictory claims, and unclear replies.
6. Prefer controlled automation over passive dashboards or opaque autopilot.

## Roadmap Direction

The next direction is to keep absorbing the useful parts of agentic GTM tools while staying centered on recruiting judgment:

- One prompt should create a running role agent, not just a search result.
- Live lead and candidate signals should decide who deserves attention now.
- Contact enrichment, outreach, follow-up, inbox triage, and scheduling should feel like one pipeline.
- Recruiters should see concrete next actions before reading long evidence packets.
- Client-facing delivery should show progress, source quality, risks, outreach state, and interview-ready candidates in one view.

## Accessibility And Inclusion

Target WCAG AA for core flows. Support reduced-motion preferences, keep contrast strong for dense evidence reading, avoid communicating claim status by color alone, and ensure source links, badges, controls, reports, and automation states remain understandable to keyboard and screen-reader users.
