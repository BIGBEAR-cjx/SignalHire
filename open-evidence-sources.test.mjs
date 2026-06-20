import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpenEvidenceLeadRowsForRun,
  buildOpenEvidenceSearchQueries,
  buildOpenEvidenceSourceRequests,
  buildOpenEvidenceSourcePromptBlock,
  runOpenEvidenceSourcePrecheck,
  normalizeOpenEvidenceSourceResults,
} from "./worker/open-evidence-sources.mjs";
import {
  fetchAllowedPublicEvidencePage,
  isUrlAllowedByRobots,
  parseRobotsTxt,
} from "./worker/public-evidence-crawler.mjs";
import {
  extractMaigretAliasesFromText,
  normalizeMaigretResults,
  runMaigretProvider,
} from "./worker/maigret-provider.mjs";

test("builds open-source evidence provider requests for an AI talent brief", () => {
  const requests = buildOpenEvidenceSourceRequests("vLLM inference engineer");

  assert.deepEqual(requests.slice(0, 6).map((request) => request.provider), [
    "github",
    "huggingface",
    "openalex",
    "semantic_scholar",
    "openreview",
    "anysearch",
  ]);
  assert.equal(requests[0].url, "https://api.github.com/search/repositories?q=vLLM%20inference%20engineer%20in%3Aname%2Cdescription%2Creadme&sort=stars&order=desc&per_page=10");
  assert.equal(requests[1].url, "https://huggingface.co/api/models?search=vLLM%20inference%20engineer&limit=10&sort=downloads&direction=-1");
  assert.equal(requests[2].url, "https://api.openalex.org/works?search=vLLM%20inference%20engineer&per-page=10&sort=relevance_score%3Adesc");
  assert.equal(requests[3].url, "https://api.semanticscholar.org/graph/v1/paper/search?query=vLLM%20inference%20engineer&limit=10&fields=title%2Curl%2Cyear%2Cauthors%2CcitationCount");
  assert.equal(requests[4].url, "https://api2.openreview.net/notes/search?term=vLLM%20inference%20engineer&limit=10");
  assert.equal(requests[5].url, "https://api.anysearch.com/v1/search");
  assert.deepEqual(requests[5].body, {
    query: "vLLM inference engineer",
    max_results: 10,
    domain: "tech",
    content_types: ["web"],
    zone: "intl",
    language: "en",
  });
  assert.equal(requests[0].coverage_group, "practice");
  assert.equal(requests[2].coverage_group, "research");
  assert.equal(requests[0].budget.requests_per_run, 1);
  assert.deepEqual(requests[0].retry.statuses, [429, 500, 502, 503, 504]);
});

test("expands AI talent briefs into bounded free-source discovery queries", () => {
  const queries = buildOpenEvidenceSearchQueries("vLLM inference engineer");

  assert.equal(queries.length, 4);
  assert.deepEqual(queries, [
    "vLLM inference engineer",
    "vLLM inference engineer LinkedIn public profile",
    "vLLM inference engineer GitHub contributor",
    "vLLM inference engineer paper benchmark",
  ]);
  assert.match(queries.join(" "), /LinkedIn public profile/);
  assert.doesNotMatch(queries.join(" "), /email|phone|private contact/i);
});

test("adds free provider credentials without requiring them", () => {
  const requests = buildOpenEvidenceSourceRequests("RAG eval engineer", {
    apiKeys: { openalex: "oa-key", anysearch: "as-key" },
  });
  const openalex = requests.find((request) => request.provider === "openalex");
  const anysearch = requests.find((request) => request.provider === "anysearch");

  assert.match(openalex.url, /api_key=oa-key/);
  assert.equal(anysearch.requires_json_body, true);
});

test("normalizes open-source evidence responses into candidate leads", () => {
  const leads = normalizeOpenEvidenceSourceResults({
    github: {
      items: [{
        full_name: "vllm-project/vllm",
        html_url: "https://github.com/vllm-project/vllm",
        description: "LLM inference and serving engine",
        stargazers_count: 90000,
        owner: { login: "vllm-project", html_url: "https://github.com/vllm-project" },
      }],
    },
    huggingface: [
      { id: "meta-llama/Llama-3.1-8B", author: "meta-llama", downloads: 1000000, likes: 1200 },
    ],
    openalex: {
      results: [{
        title: "Efficient LLM Serving",
        id: "https://openalex.org/W123",
        publication_year: 2024,
        authorships: [{ author: { display_name: "Ada Lovelace", id: "https://openalex.org/A1" } }],
      }],
    },
    semantic_scholar: {
      data: [{
        title: "RAG Evaluation",
        url: "https://www.semanticscholar.org/paper/abc",
        year: 2024,
        citationCount: 42,
        authors: [{ name: "Grace Hopper", authorId: "1741101" }],
      }],
    },
    openreview: {
      notes: [{
        id: "note123",
        content: { title: { value: "Agent Benchmark" }, authors: { value: ["Lin Chen"] } },
        forum: "forum123",
      }],
    },
    anysearch: {
      data: {
        results: [{
          title: "GitHub - vllm-project/vllm: high-throughput LLM serving",
          url: "https://github.com/vllm-project/vllm",
          snippet: "Contributors include WoosukKwon and others.",
          content: "Repository metadata for vLLM.",
        }],
      },
    },
  });

  assert.equal(leads.length, 6);
  assert.deepEqual(leads.map((lead) => lead.source_type), ["code", "huggingface", "paper", "paper", "paper", "code"]);
  assert.equal(leads[0].candidate_name, "vllm-project");
  assert.equal(leads[0].url, "https://github.com/vllm-project/vllm");
  assert.equal(leads[0].family, "github_repo");
  assert.equal(leads[1].candidate_name, "meta-llama");
  assert.equal(leads[2].candidate_name, "Ada Lovelace");
  assert.equal(leads[4].url, "https://openreview.net/forum?id=forum123");
  assert.equal(leads[5].provider, "anysearch");
  assert.equal(leads[5].candidate_name, "vllm-project");
  assert.equal(leads[5].family, "anysearch_github");
});

test("extracts Maigret aliases only from explicit public profile URLs", () => {
  const aliases = extractMaigretAliasesFromText(`
    Candidate links:
    GitHub: https://github.com/woosukkwon/vllm
    Hugging Face: https://huggingface.co/meta-llama/Llama-3.1-8B
    Portfolio: https://example.dev/about
    LinkedIn: https://www.linkedin.com/in/private-session-profile
    Search for Ada Lovelace platform engineer
  `);

  assert.deepEqual(aliases, [
    { alias: "woosukkwon", source: "github", url: "https://github.com/woosukkwon/vllm" },
    { alias: "meta-llama", source: "huggingface", url: "https://huggingface.co/meta-llama/Llama-3.1-8B" },
  ]);
});

test("normalizes Maigret output into open evidence profile leads", () => {
  const leads = normalizeMaigretResults(`
{"site_name":"GitHub","url_user":"https://github.com/woosukkwon","username":"woosukkwon","status":"Claimed","ids_data":{"fullname":"Woosuk Kwon","bio":"vLLM maintainer"}}
{"site_name":"Reddit","url_user":"https://www.reddit.com/user/woosukkwon","username":"woosukkwon","status":"Claimed","ids_data":{"location":"San Francisco"}}
{"site_name":"Example","url_user":"https://example.com/missing","username":"woosukkwon","status":"Available"}
`, { alias: "woosukkwon" });

  assert.equal(leads.length, 2);
  assert.equal(leads[0].provider, "maigret");
  assert.equal(leads[0].family, "maigret_github");
  assert.equal(leads[0].coverage_group, "public_voice");
  assert.equal(leads[0].source_type, "code");
  assert.equal(leads[0].candidate_name, "woosukkwon");
  assert.equal(leads[0].title, "GitHub - Woosuk Kwon");
  assert.equal(leads[0].url, "https://github.com/woosukkwon");
  assert.equal(leads[1].source_type, "community");
});

test("runs Maigret provider only when explicitly enabled and keeps failures isolated", async () => {
  const disabled = await runMaigretProvider("GitHub https://github.com/woosukkwon/vllm", {
    enabled: false,
    execFileImpl: async () => {
      throw new Error("should not run");
    },
  });

  assert.deepEqual(disabled.leads, []);
  assert.equal(disabled.provider_stats.maigret.status, "disabled");

  const executed = await runMaigretProvider("GitHub https://github.com/woosukkwon/vllm", {
    enabled: true,
    execFileImpl: async (_file, args) => {
      assert.deepEqual(args.slice(0, 5), ["woosukkwon", "--top-sites", "200", "--tags", "coding,global,us"]);
      return { stdout: "{\"site_name\":\"GitHub\",\"url_user\":\"https://github.com/woosukkwon\",\"username\":\"woosukkwon\",\"status\":\"Claimed\"}\n" };
    },
    nowImpl: () => 1000,
  });

  assert.equal(executed.leads.length, 1);
  assert.equal(executed.provider_stats.maigret.status, "ok");
  assert.equal(executed.provider_stats.maigret.requests, 1);
  assert.equal(executed.provider_stats.maigret.lead_count, 1);

  const failed = await runMaigretProvider("GitHub https://github.com/woosukkwon/vllm", {
    enabled: true,
    execFileImpl: async () => {
      throw new Error("maigret not installed");
    },
  });

  assert.deepEqual(failed.leads, []);
  assert.equal(failed.errors[0].provider, "maigret");
  assert.match(failed.provider_stats.maigret.error, /maigret not installed/);
});

test("builds a compact worker prompt block for open evidence sources", () => {
  const block = buildOpenEvidenceSourcePromptBlock("vLLM inference engineer");

  assert.match(block, /OPEN-SOURCE EVIDENCE ENRICHMENT PLAN/);
  assert.match(block, /GitHub repository search/);
  assert.match(block, /Hugging Face model search/);
  assert.match(block, /OpenAlex works search/);
  assert.match(block, /Semantic Scholar paper search/);
  assert.match(block, /OpenReview note search/);
  assert.match(block, /AnySearch agent search/);
});

test("runs open-source evidence precheck with optional provider keys and tolerates provider failures", async () => {
  const calls = [];
  const payloads = new Map([
    ["github", { items: [{ full_name: "vllm-project/vllm", html_url: "https://github.com/vllm-project/vllm", owner: { login: "vllm-project" }, stargazers_count: 9 }] }],
    ["huggingface", [{ id: "meta-llama/Llama-3.1-8B", author: "meta-llama", downloads: 10 }]],
    ["openalex", { results: [] }],
    ["openreview", { notes: [] }],
    ["anysearch", { data: { results: [] } }],
  ]);
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {} });
    if (url.includes("semanticscholar")) return { ok: false, status: 429, json: async () => ({}) };
    const provider = url.includes("github") ? "github"
      : url.includes("huggingface") ? "huggingface"
        : url.includes("openalex") ? "openalex"
          : url.includes("anysearch") ? "anysearch"
          : "openreview";
    return { ok: true, status: 200, json: async () => payloads.get(provider) };
  };

  const result = await runOpenEvidenceSourcePrecheck("vLLM inference engineer", {
    fetchImpl,
    sleepImpl: async () => {},
    apiKeys: {
      github: "gh-token",
      semantic_scholar: "s2-token",
      anysearch: "as-token",
    },
  });

  assert.equal(calls.length, 7);
  assert.equal(calls[0].headers.Authorization, "Bearer gh-token");
  assert.equal(calls[1].headers.Authorization, undefined);
  assert.equal(calls[3].headers["x-api-key"], "s2-token");
  const anysearchCall = calls.find((call) => call.url.includes("api.anysearch.com"));
  assert.equal(anysearchCall.headers.Authorization, "Bearer as-token");
  assert.equal(anysearchCall.headers["content-type"], "application/json");
  assert.deepEqual(result.errors, [{ provider: "semantic_scholar", status: 429 }]);
  assert.equal(result.provider_stats.semantic_scholar.attempts, 2);
  assert.deepEqual(result.leads.map((lead) => lead.candidate_name), ["vllm-project", "meta-llama"]);
  assert.equal(result.responses.github.items.length, 1);
  assert.equal(result.responses.semantic_scholar, undefined);
});

test("optionally merges Maigret profile leads into open evidence precheck", async () => {
  const fetchImpl = async (url) => {
    const payload = url.includes("github")
      ? { items: [] }
      : url.includes("huggingface")
        ? []
        : url.includes("openalex")
          ? { results: [] }
          : url.includes("semanticscholar")
            ? { data: [] }
            : url.includes("anysearch")
              ? { data: { results: [] } }
              : { notes: [] };
    return { ok: true, status: 200, json: async () => payload };
  };

  const result = await runOpenEvidenceSourcePrecheck("Backfill candidate GitHub https://github.com/woosukkwon/vllm", {
    fetchImpl,
    sleepImpl: async () => {},
    maigret: {
      enabled: true,
      execFileImpl: async () => ({ stdout: "{\"site_name\":\"GitHub\",\"url_user\":\"https://github.com/woosukkwon\",\"username\":\"woosukkwon\",\"status\":\"Claimed\"}\n" }),
      nowImpl: () => 1000,
    },
  });

  assert.equal(result.provider_stats.maigret.status, "ok");
  assert.equal(result.provider_stats.maigret.lead_count, 1);
  assert.equal(result.leads.some((lead) => lead.provider === "maigret" && lead.url === "https://github.com/woosukkwon"), true);
});

test("runs multiple expanded free-source queries with provider caps and Hugging Face token", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, headers: init.headers ?? {} });
    const payload = url.includes("github")
      ? { items: [{ full_name: "sgl-project/sglang", html_url: "https://github.com/sgl-project/sglang", owner: { login: "sgl-project" }, stargazers_count: 10 }] }
      : url.includes("huggingface")
        ? [{ id: "example-ai/rag-eval", author: "example-ai", downloads: 20 }]
        : url.includes("openalex")
          ? { results: [] }
          : url.includes("semanticscholar")
            ? { data: [] }
            : url.includes("anysearch")
              ? { data: { results: [] } }
            : { notes: [] };
    return { ok: true, status: 200, json: async () => payload };
  };

  const result = await runOpenEvidenceSourcePrecheck("SGLang RAG eval engineer", {
    fetchImpl,
    sleepImpl: async () => {},
    apiKeys: { huggingface: "hf-token", openalex: "oa-key" },
    maxQueries: 2,
  });

  assert.equal(calls.length, 12);
  assert.equal(calls.filter((call) => call.url.includes("api.github.com")).length, 2);
  assert.equal(calls.filter((call) => call.url.includes("huggingface.co")).length, 2);
  assert.equal(calls.filter((call) => call.url.includes("api.anysearch.com")).length, 2);
  assert.ok(calls.some((call) => call.url.includes("api_key=oa-key")));
  assert.ok(calls.filter((call) => call.url.includes("huggingface.co")).every((call) => call.headers.Authorization === "Bearer hf-token"));
  assert.equal(result.provider_stats.github.requests, 2);
  assert.equal(result.provider_stats.huggingface.requests, 2);
  assert.ok(result.leads.length >= 2);
});

test("retries retryable provider responses and reports provider stats", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("github") && calls.filter((call) => call.includes("github")).length === 1) {
      return { ok: false, status: 429, json: async () => ({}) };
    }
    const payload = url.includes("github")
      ? { items: [{ full_name: "vllm-project/vllm", html_url: "https://github.com/vllm-project/vllm", owner: { login: "vllm-project" }, stargazers_count: 9 }] }
      : url.includes("huggingface")
        ? []
        : url.includes("openalex")
          ? { results: [] }
          : url.includes("semanticscholar")
            ? { data: [] }
            : url.includes("anysearch")
              ? { data: { results: [] } }
            : { notes: [] };
    return { ok: true, status: 200, json: async () => payload };
  };

  const result = await runOpenEvidenceSourcePrecheck("vLLM inference engineer", {
    fetchImpl,
    sleepImpl: async () => {},
    nowImpl: () => 1000,
  });

  assert.equal(calls.filter((url) => url.includes("github")).length, 2);
  assert.equal(result.errors.length, 0);
  assert.equal(result.provider_stats.github.attempts, 2);
  assert.equal(result.provider_stats.github.status, 200);
  assert.equal(result.provider_stats.github.duration_ms, 0);
  assert.equal(result.provider_stats.github.lead_count, 1);
});

test("builds open evidence lead rows with run context before identity resolution", () => {
  assert.equal(typeof buildOpenEvidenceLeadRowsForRun, "function");

  const rows = buildOpenEvidenceLeadRowsForRun({
    userId: "user-1",
    sourceRunId: "run-1",
    queryText: "vLLM inference engineer",
    observedAt: "2026-06-12T00:00:00.000Z",
    leads: [
      {
        provider: "github",
        family: "github_repo",
        coverage_group: "practice",
        source_type: "code",
        candidate_name: "vllm-project",
        title: "vllm-project/vllm",
        url: "https://github.com/vllm-project/vllm",
        metric: 90000,
        year: null,
      },
      {
        provider: "github",
        family: "github_repo",
        coverage_group: "practice",
        source_type: "code",
        candidate_name: "vllm-project",
        title: "vllm-project/vllm duplicate",
        url: "https://github.com/vllm-project/vllm",
        metric: 90000,
        year: null,
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, "user-1");
  assert.equal(rows[0].source_run_id, "run-1");
  assert.equal(rows[0].query_text, "vLLM inference engineer");
  assert.equal(rows[0].provider, "github");
  assert.equal(rows[0].candidate_name, "vllm-project");
  assert.equal(rows[0].title, "vllm-project/vllm");
  assert.equal(rows[0].url, "https://github.com/vllm-project/vllm");
  assert.equal(rows[0].metric, 90000);
  assert.equal(rows[0].observed_at, "2026-06-12T00:00:00.000Z");
  assert.match(rows[0].cache_key, /^user-1:run-1:github:/);
});

test("public evidence crawler honors robots rules before fetching pages", async () => {
  const rules = parseRobotsTxt("User-agent: *\nDisallow: /private\nAllow: /private/team\nCrawl-delay: 2\n");

  assert.equal(isUrlAllowedByRobots("https://example.com/public/team", rules), true);
  assert.equal(isUrlAllowedByRobots("https://example.com/private/profile", rules), false);
  assert.equal(isUrlAllowedByRobots("https://example.com/private/team", rules), true);
  assert.equal(rules.crawlDelayMs, 2000);
});

test("public evidence crawler fetches only allowed public http pages", async () => {
  const calls = [];
  const robots = new Map([
    ["https://example.com/robots.txt", "User-agent: *\nDisallow: /blocked\n"],
  ]);
  const pages = new Map([
    ["https://example.com/team", "<html><title>Team</title><body>Ada Lovelace</body></html>"],
  ]);
  const fetchImpl = async (url) => {
    calls.push(url);
    if (robots.has(url)) return { ok: true, status: 200, text: async () => robots.get(url), headers: { get: () => "text/plain" } };
    if (pages.has(url)) return { ok: true, status: 200, text: async () => pages.get(url), headers: { get: () => "text/html" } };
    return { ok: false, status: 404, text: async () => "", headers: { get: () => "" } };
  };

  const allowed = await fetchAllowedPublicEvidencePage("https://example.com/team", { fetchImpl });
  const blocked = await fetchAllowedPublicEvidencePage("https://example.com/blocked/profile", { fetchImpl });
  const privateUrl = await fetchAllowedPublicEvidencePage("https://example.com/login?next=/team", { fetchImpl });

  assert.equal(allowed.allowed, true);
  assert.match(allowed.text, /Ada Lovelace/);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, "robots_disallow");
  assert.equal(privateUrl.allowed, false);
  assert.equal(privateUrl.reason, "private_or_login_url");
  assert.deepEqual(calls, [
    "https://example.com/robots.txt",
    "https://example.com/team",
    "https://example.com/robots.txt",
  ]);
});

test("public evidence crawler blocks LinkedIn profile crawling", async () => {
  const result = await fetchAllowedPublicEvidencePage("https://www.linkedin.com/in/example-person", {
    fetchImpl: async () => {
      throw new Error("should not fetch blocked hosts");
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "blocked_host");
});
