export function assertTalentPayload(status) {
  const result = status?.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`Job reached done without object result: ${JSON.stringify(status)}`);
  }
  if (!("search_brief" in result)) {
    throw new Error(`Job result missing search_brief: ${JSON.stringify(result)}`);
  }
  if (!("search_plan" in result) || !result.search_plan || typeof result.search_plan !== "object") {
    throw new Error(`Job result missing search_plan: ${JSON.stringify(result)}`);
  }
  if (!Array.isArray(result.talent_map)) {
    throw new Error(`Job result missing talent_map array: ${JSON.stringify(result)}`);
  }
  if (!("evidence_graph" in result) || !result.evidence_graph || typeof result.evidence_graph !== "object") {
    throw new Error(`Job result missing evidence_graph: ${JSON.stringify(result)}`);
  }
  if (!Array.isArray(result.candidates)) {
    throw new Error(`Job result missing candidates array: ${JSON.stringify(result)}`);
  }
  if (result.candidates.length < 10 || result.candidates.length > 15) {
    throw new Error(`Expected 10-15 candidates, got ${result.candidates.length}`);
  }

  result.candidates.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`Candidate ${index} must be an object: ${JSON.stringify(candidate)}`);
    }
    if (!candidate.name) {
      throw new Error(`Candidate ${index} missing name: ${JSON.stringify(candidate)}`);
    }
    if (!Number.isFinite(Number(candidate.match_score))) {
      throw new Error(`Candidate ${index} missing finite match_score: ${JSON.stringify(candidate)}`);
    }
    if (!("evidence_audit" in candidate)) {
      throw new Error(`Candidate ${index} missing evidence_audit: ${JSON.stringify(candidate)}`);
    }
    if (!Array.isArray(candidate.claims)) {
      throw new Error(`Candidate ${index} missing claims array: ${JSON.stringify(candidate)}`);
    }
  });
}

export function normalizeAuthCookie(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (raw.includes("=")) return raw;
  return `sh_token=${encodeURIComponent(raw)}`;
}

async function defaultCreateAuthClient(baseUrl) {
  const { createClient } = await import("@insforge/sdk");
  return createClient({ baseUrl });
}

export async function resolveAuthCookie({
  cookie = "",
  email = "",
  password = "",
  insforgeBaseUrl = "",
  createAuthClient = defaultCreateAuthClient,
} = {}) {
  const existing = normalizeAuthCookie(cookie);
  if (existing) return existing;
  if (!email && !password) return "";
  if (!email || !password) throw new Error("RESEARCH_VERIFY_EMAIL and RESEARCH_VERIFY_PASSWORD must be provided together");
  if (!insforgeBaseUrl) throw new Error("NEXT_PUBLIC_INSFORGE_API_BASE_URL or INSFORGE_API_BASE_URL is required for verify login");

  const client = await createAuthClient(insforgeBaseUrl);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Verify login failed: ${error.message || "unknown auth error"}`);
  if (!data?.accessToken) throw new Error("Verify login did not return accessToken");
  return normalizeAuthCookie(data.accessToken);
}
