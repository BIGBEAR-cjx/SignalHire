function hasConfiguredValue(value) {
  if (typeof value === "string") return value.trim().length > 0;
  if (value === true) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value).length > 0;
}

function cleanIdentifier(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Creates the safe, serializable portion of a browser QA fixture.
 *
 * Owner and customer values only indicate whether their runtime sessions were
 * supplied; their credential values are intentionally never retained here.
 */
export function buildQaFixture(input = {}) {
  const fixture = input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    owner: hasConfiguredValue(fixture.owner) ? "configured" : null,
    customer: hasConfiguredValue(fixture.customer) ? "configured" : null,
    projectId: cleanIdentifier(fixture.projectId),
    reportId: cleanIdentifier(fixture.reportId),
  };
}

export function classifyBrowserPrerequisites({ playwright, fixture } = {}) {
  const normalizedFixture = buildQaFixture(fixture);
  const ready = Boolean(playwright)
    && normalizedFixture.owner
    && normalizedFixture.customer
    && normalizedFixture.projectId;

  return ready
    ? { status: "ready", reason: "" }
    : { status: "blocked", reason: "missing_playwright_or_qa_fixture" };
}
