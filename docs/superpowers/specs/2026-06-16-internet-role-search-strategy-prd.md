# SignalHire Internet Role-Aware Search Strategy PRD

## Goal

Upgrade SignalHire from an AI-talent-specific search flow to a role-aware sourcing system for all major internet positions. The system must parse the hiring brief, identify the role category, separate employer context from candidate requirements, generate role-specific channels and query variants, and preserve evidence-first candidate review.

## Role Coverage

The strategy layer covers 12 internet role categories:

1. `software_engineering`
2. `ai_ml_data`
3. `product_management`
4. `design_creative`
5. `growth_marketing`
6. `operations_community`
7. `sales_bd_gtm`
8. `customer_success_support`
9. `security_infra_devops`
10. `business_strategy_ops`
11. `people_finance_admin`
12. `executive_founder_leadership`

Each category owns its own source channels, query clusters, scoring dimensions, adjacent pools, and evidence expectations.

## Requirements

- Parse pasted JD noise such as duplicated "copy/share" lines, hashtag labels, section titles, and employer/product context.
- Treat employer/company/product information as search context, not as candidate target criteria.
- Generate a role-aware `SearchIntakeDraft` with role category, employer context, candidate requirements, negative constraints, channel plan, query clusters, and score dimensions.
- Generate `AgentSearchStrategy` with `recall_mode: aggressive_public_web_recall`.
- Use aggressive public-web recall while avoiding login-gated scraping, private data extraction, and private contact guessing.
- Preserve evidence-first behavior: concrete URLs are required for verified claims, weak evidence remains unverified, and source mix remains visible.
- Keep existing `/app/search`, search task queueing, candidate reports, shortlist, and evidence audit behavior compatible.

## UX Requirements

- Search intake should show the detected role category, employer context, must-have, nice-to-have, exclusions, and channel plan before running search.
- Search result workspace should continue to show completion summary, source mix, execution trace, delivery clusters, candidate list, and candidate report.
- Role-specific strategies should be visible through execution metadata and not hidden inside prompt-only behavior.

## Acceptance

- All 12 categories classify correctly with representative JD/query inputs.
- AI Growth/Marketing uses content/social/growth-case/community routes instead of defaulting to GitHub/paper.
- Engineering and AI infrastructure roles keep code/open-source implementation routes.
- Design roles include portfolio/Behance/Dribbble style evidence routes.
- Sales/BD/GTM roles include customer case, company, industry-network routes.
- Prompt no longer contains the global `AI DIRECTIONS` block.
- Open-evidence queries accept public LinkedIn/social/profile leads but still reject email/phone/private-contact guessing.
