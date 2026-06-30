import test from "node:test";
import assert from "node:assert/strict";
import { buildReferralPathViews, normalizeNetworkSeed, parseNetworkSeedCsv } from "./web/lib/referral-paths.mjs";

test("normalizes network seeds without exposing private contact fields", () => {
  const seed = normalizeNetworkSeed({
    name: "Grace",
    company: "Example AI",
    school: "MIT",
    project: "vLLM",
    linkedin_url: "https://www.linkedin.com/in/grace/",
    email: "grace@example.com",
    phone: "+1 555 0100",
    private_notes: "met at private dinner",
  });

  assert.equal(seed.label, "Grace");
  assert.equal(seed.linkedin_url, "linkedin.com/in/grace");
  assert.deepEqual(seed.companies, ["Example AI"]);
  assert.deepEqual(seed.schools, ["MIT"]);
  assert.deepEqual(seed.projects, ["vLLM"]);
  assert.equal("email" in seed, false);
  assert.equal("phone" in seed, false);
  assert.equal("private_notes" in seed, false);
});

test("parses CSV network seeds and drops private fields", () => {
  const seeds = parseNetworkSeedCsv(`name,company,school,project,linkedin_url,email,private_notes
Grace,Example AI,MIT,vLLM,https://linkedin.com/in/grace,grace@example.com,do not share
"Ada Lovelace","Analytical Engines","University of London","Compiler, Notes","https://www.linkedin.com/in/ada","ada@example.com","private"`);

  assert.deepEqual(seeds, [
    {
      label: "Grace",
      relation: "",
      linkedin_url: "linkedin.com/in/grace",
      companies: ["Example AI"],
      schools: ["MIT"],
      projects: ["vLLM"],
    },
    {
      label: "Ada Lovelace",
      relation: "",
      linkedin_url: "linkedin.com/in/ada",
      companies: ["Analytical Engines"],
      schools: ["University of London"],
      projects: ["Compiler", "Notes"],
    },
  ]);
  assert.doesNotMatch(JSON.stringify(seeds), /example\.com|private|do not share/);
});

test("builds manual and shared-context referral paths with safe intro snippets", () => {
  const views = buildReferralPathViews({
    locale: "en",
    candidates: [
      {
        name: "Ada",
        headline: "AI Infra Lead",
        current_company: "Example AI",
        links: { linkedin: "https://linkedin.com/in/ada" },
        schools: ["MIT"],
        projects: ["vLLM"],
      },
      {
        name: "Lin",
        current_company: "Other Labs",
        links: { linkedin: "https://linkedin.com/in/lin" },
      },
    ],
    networkSeeds: [
      {
        name: "Team seed",
        linkedin_url: "https://www.linkedin.com/in/ada/",
        relation: "manual_seed",
        email: "team@example.com",
        private_notes: "do not share",
      },
      { name: "Grace", company: "Example AI", school: "MIT", project: "vLLM" },
    ],
  });

  const ada = views.find((view) => view.candidate_name === "Ada");
  const lin = views.find((view) => view.candidate_name === "Lin");

  assert.ok(ada);
  assert.equal(lin, undefined);
  assert.equal(ada.paths.length, 2);
  assert.deepEqual(ada.paths.map((path) => path.path_type), ["manual_seed", "shared_company"]);
  assert.match(ada.paths[0].shared_context, /manual LinkedIn seed/i);
  assert.match(ada.paths[1].shared_context, /may have shared context/i);
  assert.match(ada.paths[1].intro_snippet, /Ada/);
  assert.match(ada.paths[1].intro_snippet, /Example AI/);
  assert.equal(ada.paths.every((path) => path.client_safe), true);
  assert.doesNotMatch(JSON.stringify(ada), /team@example\.com|do not share/);
});

test("builds shared school and project paths when company is not shared", () => {
  const [view] = buildReferralPathViews({
    locale: "en",
    candidates: [{
      name: "Mira",
      current_company: "New Co",
      education: [{ school: "Stanford" }],
      projects: ["OpenAgents"],
    }],
    networkSeeds: [
      { name: "Advisor", school: "Stanford" },
      { name: "Builder", project: "OpenAgents" },
    ],
  });

  assert.equal(view.candidate_name, "Mira");
  assert.deepEqual(view.paths.map((path) => path.path_type), ["shared_school", "shared_project"]);
  assert.match(view.paths[0].shared_context, /Stanford/);
  assert.match(view.paths[1].shared_context, /OpenAgents/);
});
