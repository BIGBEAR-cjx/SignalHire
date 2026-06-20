# Candidate Database Expansion Research

Last checked: 2026-06-12

## Recommendation

Do not buy a broad contact database first. SignalHire's defensible wedge is AI talent evidence review, so the next data expansion should increase candidate recall while preserving evidence quality:

1. Build an AI evidence index from open and low-cost technical sources.
2. Add paid SERP at scale to discover personal pages, project pages, talks, team pages, and long-tail public profiles.
3. Add people/company enrichment only after a candidate already has a strong evidence dossier.
4. Add email/contact enrichment as a manual action for shortlisted candidates, not as the core search product.

## Source Tiers

| Tier | Sources | What it improves | Cost posture | Risks |
|---|---|---|---|---|
| 1. Open AI evidence | GitHub, Hugging Face, OpenAlex, Semantic Scholar, OpenReview, arXiv/OpenReview pages | More AI-specific candidates and stronger technical evidence | Mostly free/API-key limited | Rate limits, identity resolution, noisy author names |
| 2. Paid public discovery | SerpApi, SearchApi, Bright Data SERP | More long-tail public pages and company/team/source discovery | Low-to-medium variable cost | Search result quality, duplicate pages, query design |
| 3. People/company enrichment | People Data Labs, Proxycurl/LinkDB, Apollo, Crunchbase | More complete profiles and company context | Paid credits or license | Compliance review, non-AI noise, vendor lock-in |
| 4. Contact enrichment | Hunter, Apollo, PDL email fields, other email finders | Contactability after shortlist | Paid credits | Pushes product toward outreach-first competitors |

## Practical Integration Order

### 1. Profile cache from existing evidence

Implemented in this branch. Use the new `buildCandidateProfileCacheEntry` output as the cache schema seed:

- `cache_key`
- `name`
- `role`
- `ai_directions`
- `vertical_tags`
- `match_score`
- `confidence`
- `independent_sources`
- `source_types`
- `evidence_urls`
- `search_text`
- `structured_sources`

The first implementation stores normalized candidate snapshots from successful search runs into `candidate_profiles`, stores each concrete evidence URL into `candidate_evidence_sources`, and ranks cached candidates for new searches. Queued worker jobs now receive top cache hints, but the prompt explicitly requires continued search and re-verification instead of stopping at cached people.

This immediately enables dedupe, similar candidates, source-family analytics, and next-round reranking without purchasing data.

Deployment checks:

- Apply the table migration with `npm --prefix web run migrate:ai-cache` after `INSFORGE_API_BASE_URL` and `INSFORGE_API_KEY` are present in `web/.env.local` or the shell environment.
- Verify the deployed schema with `npm --prefix web run verify:schema`; this checks both `research_runs` and the AI talent cache tables.

### 2. Open-source AI evidence crawlers

Implemented in this branch as a tested source surface and worker precheck:

- `worker/open-evidence-sources.mjs` builds provider request URLs for GitHub, Hugging Face, OpenAlex, Semantic Scholar, and OpenReview.
- It expands each AI talent brief into bounded discovery variants such as the raw brief, GitHub contributor, paper/benchmark, and Hugging Face model queries. Worker runtime defaults to `OPEN_EVIDENCE_MAX_QUERIES=4`, capped at 8.
- It normalizes sample provider payloads into candidate leads with provider, family, coverage group, source type, candidate name, title, URL, metric, and year.
- Worker and web search prompts now include an open-source evidence enrichment plan so source_strategy output stays aligned with these provider families.
- Worker search jobs now execute the open-source precheck before MiroMind research, pass normalized leads into the prompt, tolerate per-provider failures, and support optional GitHub, Semantic Scholar, OpenAlex, and Hugging Face API keys.
- Normalized precheck leads are stored in `open_evidence_leads` with user, run, query, provider, source family, candidate name, source URL, metric, and year before model identity resolution.
- Each provider has an explicit per-query request budget, timeout, retryable status list, retry/backoff policy, and provider-level stats for attempts, requests, final status, duration, and lead count in worker logs.
- `worker/public-evidence-crawler.mjs` provides the safe public-page fetcher for future team pages, conference pages, project pages, and technical blogs. It only fetches public HTTP(S) URLs, rejects login/auth/account paths, checks `robots.txt` first, honors disallow rules, captures crawl delay, and returns bounded page text for downstream parsers.

Optional free keys:

- `GITHUB_TOKEN`
- `SEMANTIC_SCHOLAR_API_KEY`
- `OPENALEX_API_KEY`
- `HF_TOKEN`
- `OPEN_EVIDENCE_MAX_QUERIES` (default 4 in the worker; max 8)

Remaining implementation before this is a full crawler: parsers for specific allowed page families, a promotion path from safe public pages into `candidate_evidence_sources` once identity is resolved, plus higher-volume scheduling if weekly talent maps need batch crawling.

Priority sources:

- GitHub REST/Search API for repositories, users, topics, contributors, languages, stars, commits, and README evidence.
- Hugging Face Hub search/API for model, dataset, and Space authorship signals.
- OpenAlex for author/work/institution graph coverage.
- Semantic Scholar Academic Graph API for paper details, citations, author ids, and recommendations.
- OpenReview API for conference submissions, reviewer/public profile relations, and coauthor networks.

This tier best matches SignalHire's positioning because each candidate can be explained through public work, not just a profile record.

### 3. Paid SERP for recall

Use paid SERP before paid people databases. SERP expands discoverability while still returning public evidence pages.

Candidate vendors:

- SerpApi: simple Google Search API; public pricing page currently shows Starter at $25/month for 1,000 searches and higher monthly tiers.
- SearchApi: currently advertises 100 free requests and paid plans from $40/month.
- Bright Data SERP API: currently advertises a free tier and pay-as-you-go around $1.5/1K successful requests, plus higher-volume plans.

Use cases:

- `site:github.com <skill> <project>`
- `site:huggingface.co <model/dataset/topic>`
- `site:openreview.net <topic> <conference>`
- `site:company.com/team <AI direction>`
- targeted searches for talks, blogs, benchmark leaderboards, and project docs.

### 4. People/company enrichment after evidence threshold

Only enrich candidates that meet a threshold, for example:

- match score >= 75
- at least 2 independent evidence URLs
- at least 1 AI vertical tag
- no blocking identity contradiction

Candidate vendors:

- People Data Labs: official docs describe person enrichment/search over a large person dataset; support pricing currently lists person enrichment/search monthly Tier 1 at 350-2,500 credits at $0.28/credit, minimum $98/month.
- Proxycurl/LinkDB: useful when LinkedIn-like profile resolution is needed; LinkDB pricing is much more expensive for bulk datasets, while API-style lookups can be tested first.
- Apollo: useful for company/person enrichment and later outbound workflows; API access depends on plan/credits.
- Crunchbase: useful for company/funding context, especially VC Talent Partner workflows; API/full data access is sales/license driven.

Use enrichment to fill profile gaps, current company, role history, location, and company metadata. Do not use it to decide fit without public technical evidence.

### 5. Contact enrichment as a shortlist action

Keep contact discovery behind an explicit action such as "find contact for selected candidate".

Candidate vendors:

- Hunter: email finder/verifier API; public pricing currently shows Free, Starter $49/month, Growth $149/month, Scale $299/month, with credits.
- Apollo: can provide contact and enrichment workflows, but this moves toward sales/outbound software.
- PDL email fields may help when already using person enrichment.

This preserves the product promise: SignalHire recommends candidates because evidence is strong, not because contact data is available.

## Data Model Additions

Recommended next tables:

- `candidate_profiles`
  - `id`
  - `cache_key`
  - `name`
  - `current_role`
  - `current_company`
  - `ai_directions`
  - `vertical_tags`
  - `confidence`
  - `source_types`
  - `evidence_urls`
  - `search_text`
  - `first_seen_at`
  - `last_seen_at`

- `candidate_evidence_sources`
  - `id`
  - `candidate_profile_cache_key`
  - `url`
  - `host`
  - `family`
  - `coverage_group`
  - `source_type`
  - `claim`
  - `verdict`
  - `observed_at`

- `open_evidence_leads`
  - `id`
  - `source_run_id`
  - `query_text`
  - `provider`
  - `family`
  - `coverage_group`
  - `source_type`
  - `candidate_name`
  - `title`
  - `url`
  - `metric`
  - `year`
  - `observed_at`

- `candidate_enrichment_runs`
  - `id`
  - `candidate_profile_id`
  - `vendor`
  - `purpose`
  - `cost_units`
  - `status`
  - `created_at`

## Guardrails

- Store source URLs and extracted evidence separately from contact fields.
- Mark vendor-sourced profile/contact data with `vendor`, `retrieved_at`, and usage constraints.
- Never merge two candidate identities only by name; require at least one shared strong identifier such as GitHub URL, scholar profile, personal site, company page, or multiple matching public sources.
- Keep search-result URLs out of evidence, as existing normalization already does.
- Add deletion/export controls before storing contact fields.
- Public page crawling must stay no-login, no-CAPTCHA-bypass, no fake accounts, no anti-bot circumvention, and no LinkedIn profile scraping. Fetch only public HTTP(S) pages that pass robots checks, use a clear SignalHire user agent, limit stored text, and keep the original source URL for review.

## MVP Vendor Sequence

1. No new paid vendor: cache existing search outputs, use the implemented evidence-source index, and add GitHub/Hugging Face/OpenAlex/Semantic Scholar/OpenReview enrichers.
2. Add one SERP provider for long-tail discovery. Start with the cheapest reliable monthly plan and meter query volume per project.
3. Add People Data Labs or Proxycurl only for evidence-qualified candidates where identity/profile gaps block review.
4. Add Hunter or Apollo only for shortlisted candidates where the user explicitly chooses outreach.

## Sources Checked

- People Data Labs Person Enrichment docs: https://docs.peopledatalabs.com/docs/person-enrichment-api
- People Data Labs pricing/credits support: https://support.peopledatalabs.com/hc/en-us/articles/25794271805211-Pricing-credits
- Proxycurl LinkDB pricing: https://nubela.co/proxycurl/linkdb/pricing.html
- OpenAlex API docs: https://developers.openalex.org/
- Semantic Scholar API: https://www.semanticscholar.org/product/api
- GitHub REST API rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- Hugging Face Hub API/docs: https://huggingface.co/docs/huggingface_hub/v0.5.1/en/package_reference/hf_api
- OpenReview docs/API: https://docs.openreview.net/
- SerpApi pricing: https://serpapi.com/
- SearchApi pricing: https://www.searchapi.io/pricing
- Bright Data SERP API: https://brightdata.com/products/serp-api
- Hunter pricing/API: https://hunter.io/pricing and https://hunter.io/api/email-finder
- Apollo developer/API pricing docs: https://docs.apollo.io/docs/api-pricing
- Crunchbase API/data licensing: https://about.crunchbase.com/products/crunchbase-api
