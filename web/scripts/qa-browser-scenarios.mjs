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

const CUSTOMER_SCENARIOS = [
  "login_redirect",
  "workspace",
  "project_tabs",
  "feedback",
  "revoked_access",
];

const CUSTOMER_VIEWPORT = { width: 1440, height: 900 };

export function customerScenarioNames() {
  return [...CUSTOMER_SCENARIOS];
}

export function containsSensitiveValue(value, sensitiveValues = []) {
  if (typeof value !== "string") return false;
  return sensitiveValues.some((sensitiveValue) => {
    const normalized = cleanIdentifier(sensitiveValue);
    return normalized.length > 0 && value.includes(normalized);
  });
}

function redactSensitiveValues(value, sensitiveValues = []) {
  let redacted = typeof value === "string" ? value : "";
  const values = sensitiveValues
    .map(cleanIdentifier)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const sensitiveValue of values) {
    redacted = redacted.split(sensitiveValue).join("[REDACTED]");
  }
  return redacted;
}

/**
 * Projects browser QA output to the only fields permitted in release output.
 * This keeps session tokens and arbitrary executor metadata out of CI logs.
 */
export function projectBrowserScenarioResult(result = {}, sensitiveValues = []) {
  const row = result && typeof result === "object" && !Array.isArray(result) ? result : {};
  const status = ["pass", "fail", "blocked"].includes(row.status) ? row.status : "fail";
  return {
    name: redactSensitiveValues(cleanIdentifier(row.name), sensitiveValues),
    role: redactSensitiveValues(cleanIdentifier(row.role), sensitiveValues),
    viewport: redactSensitiveValues(cleanIdentifier(row.viewport), sensitiveValues),
    status,
    screenshotPath: row.screenshotPath ? redactSensitiveValues(cleanIdentifier(row.screenshotPath), sensitiveValues) : null,
    error: redactSensitiveValues(cleanIdentifier(row.error), sensitiveValues),
  };
}

function scenarioDefinition(name) {
  if (name === "login_redirect") return { role: "anonymous", viewport: "desktop" };
  if (name === "revoked_access") return { role: "anonymous", viewport: "desktop" };
  return { role: "customer", viewport: "desktop" };
}

function scenarioResult(name, status, error = "", sensitiveValues = []) {
  const definition = scenarioDefinition(name);
  return projectBrowserScenarioResult({
    name,
    ...definition,
    status,
    screenshotPath: null,
    error,
  }, sensitiveValues);
}

function customerSessionCookie(session, origin) {
  const value = cleanIdentifier(session).replace(/^sh_token=/, "");
  return {
    name: "sh_token",
    value: decodeURIComponent(value),
    url: origin,
    httpOnly: true,
    sameSite: "Lax",
  };
}

function sessionSensitiveValues(session) {
  const original = cleanIdentifier(session);
  if (!original) return [];
  const stripped = original.replace(/^sh_token=/, "");
  let decoded = stripped;
  try {
    decoded = decodeURIComponent(stripped);
  } catch {}
  return [...new Set([original, stripped, decoded].filter(Boolean))];
}

async function openPage(browser, { origin, headers, viewport, customerSession }) {
  const context = await browser.newContext({
    viewport,
    extraHTTPHeaders: headers,
  });
  if (customerSession) await context.addCookies([customerSessionCookie(customerSession, origin)]);
  return { context, page: await context.newPage() };
}

async function visit(page, url) {
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
  return response?.status() || 0;
}

async function runScenario(browser, name, options, execute) {
  try {
    await execute();
    return scenarioResult(name, "pass", "", options.sensitiveValues);
  } catch (error) {
    return scenarioResult(name, "fail", error instanceof Error ? error.message : String(error), options.sensitiveValues);
  }
}

function requireVisible(locator, label) {
  return locator.waitFor({ state: "visible", timeout: 5000 }).catch(() => {
    throw new Error(`expected_${label}`);
  });
}

/**
 * Runs the customer-facing browser checks only. Owner-only invitation, revoke,
 * and Role Agent actions intentionally remain in the next task.
 */
export async function runCustomerBrowserScenarios({ playwright, fixture, origin, headers = {} } = {}) {
  const prerequisite = classifyBrowserPrerequisites({ playwright: Boolean(playwright?.chromium), fixture });
  const normalizedFixture = buildQaFixture(fixture);
  const sensitiveValues = [
    ...sessionSensitiveValues(fixture?.owner),
    ...sessionSensitiveValues(fixture?.customer),
    ...Object.values(headers),
  ].filter((value) => typeof value === "string");
  if (prerequisite.status !== "ready") {
    return customerScenarioNames().map((name) => scenarioResult(name, "blocked", prerequisite.reason, sensitiveValues));
  }

  const options = {
    origin: cleanIdentifier(origin).replace(/\/+$/, ""),
    headers,
    sensitiveValues,
  };
  const browser = await playwright.chromium.launch({ headless: true });
  try {
    const projectPath = `/client/projects/${encodeURIComponent(normalizedFixture.projectId)}`;
    const results = [];

    results.push(await runScenario(browser, "login_redirect", options, async () => {
      const { context, page } = await openPage(browser, { ...options, viewport: CUSTOMER_VIEWPORT });
      try {
        await visit(page, `${options.origin}/client`);
        const loginLink = page.getByRole("link", { name: /sign in|登录/i }).first();
        await requireVisible(loginLink, "client_login_link");
        await loginLink.click();
        await page.waitForURL((url) => url.pathname === "/login" && url.searchParams.get("next") === "/client", { timeout: 5000 });
        await requireVisible(page.getByRole("heading", { name: /sign in|登录/i }).first(), "login_page");
      } finally {
        await context.close();
      }
    }));

    results.push(await runScenario(browser, "workspace", options, async () => {
      const { context, page } = await openPage(browser, {
        ...options,
        viewport: CUSTOMER_VIEWPORT,
        customerSession: fixture.customer,
      });
      try {
        const status = await visit(page, `${options.origin}/client`);
        if (status !== 200) throw new Error(`unexpected_workspace_status=${status}`);
        await requireVisible(page.getByRole("heading", { name: /client delivery workspace|客户交付工作台/i }).first(), "customer_workspace");
      } finally {
        await context.close();
      }
    }));

    results.push(await runScenario(browser, "project_tabs", options, async () => {
      const { context, page } = await openPage(browser, {
        ...options,
        viewport: CUSTOMER_VIEWPORT,
        customerSession: fixture.customer,
      });
      try {
        const status = await visit(page, `${options.origin}${projectPath}`);
        if (status !== 200) throw new Error(`unexpected_project_status=${status}`);
        for (const label of [
          /overview|概览/i,
          /interview-ready/i,
          /weekly archive|周交付归档/i,
          /reports|报告版本/i,
          /feedback|反馈/i,
        ]) {
          const tab = page.getByRole("button", { name: label }).first();
          await requireVisible(tab, "project_tab");
          await tab.click();
        }
      } finally {
        await context.close();
      }
    }));

    if (!normalizedFixture.reportId) {
      results.push(scenarioResult("feedback", "blocked", "missing_report_fixture", sensitiveValues));
    } else {
      results.push(await runScenario(browser, "feedback", options, async () => {
        const { context, page } = await openPage(browser, {
          ...options,
          viewport: CUSTOMER_VIEWPORT,
          customerSession: fixture.customer,
        });
        try {
          const status = await visit(page, `${options.origin}${projectPath}`);
          if (status !== 200) throw new Error(`unexpected_feedback_project_status=${status}`);
          const feedbackTab = page.getByRole("button", { name: /feedback|反馈/i }).first();
          await requireVisible(feedbackTab, "feedback_tab");
          await feedbackTab.click();
          const note = page.locator("textarea").first();
          await requireVisible(note, "feedback_note");
          await note.fill("QA browser verification feedback");
          await page.getByRole("button", { name: /send feedback|提交反馈/i }).click();
          await page.waitForFunction(() => document.querySelector("textarea")?.value === "", { timeout: 5000 });
        } finally {
          await context.close();
        }
      }));
    }

    results.push(await runScenario(browser, "revoked_access", options, async () => {
      const { context, page } = await openPage(browser, { ...options, viewport: CUSTOMER_VIEWPORT });
      try {
        await visit(page, `${options.origin}/login?next=/client`);
        const deniedStatus = await page.evaluate(async (path) => {
          const response = await fetch(path, { credentials: "omit" });
          return response.status;
        }, `/api/client-portal/projects/${encodeURIComponent(normalizedFixture.projectId)}`);
        if (deniedStatus !== 401) throw new Error(`expected_unauthorized_status=401 actual=${deniedStatus}`);
      } finally {
        await context.close();
      }
    }));

    return results;
  } finally {
    await browser.close();
  }
}
