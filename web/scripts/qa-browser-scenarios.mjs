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
  "anonymous_access_denied",
];

const OWNER_SCENARIOS = [
  "client_access_settings",
  "invite",
  "revoke",
  "role_agent_success",
  "role_agent_error",
  "role_agent_disabled",
];

const CUSTOMER_VIEWPORT = { width: 1440, height: 900 };

export function customerScenarioNames() {
  return [...CUSTOMER_SCENARIOS];
}

export function ownerScenarioNames() {
  return [...OWNER_SCENARIOS];
}

export function summarizeBrowserChecks(results = []) {
  const checks = Array.isArray(results) ? results : [];
  const summary = { total: checks.length, passed: 0, failed: 0, blocked: 0, releaseReady: false };
  for (const result of checks) {
    if (result?.status === "pass" || result?.status === "passed") summary.passed += 1;
    else if (result?.status === "blocked") summary.blocked += 1;
    else summary.failed += 1;
  }
  summary.releaseReady = summary.total > 0 && summary.passed === summary.total;
  return summary;
}

export function containsSensitiveValue(value, sensitiveValues = []) {
  if (typeof value !== "string") return false;
  return sensitiveValues.some((sensitiveValue) => {
    const normalized = cleanIdentifier(sensitiveValue);
    return normalized.length > 0 && value.includes(normalized);
  });
}

export function redactBrowserQaText(value, sensitiveValues = []) {
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
    name: redactBrowserQaText(cleanIdentifier(row.name), sensitiveValues),
    role: redactBrowserQaText(cleanIdentifier(row.role), sensitiveValues),
    viewport: redactBrowserQaText(cleanIdentifier(row.viewport), sensitiveValues),
    status,
    screenshotPath: row.screenshotPath ? redactBrowserQaText(cleanIdentifier(row.screenshotPath), sensitiveValues) : null,
    error: redactBrowserQaText(cleanIdentifier(row.error), sensitiveValues),
  };
}

function scenarioDefinition(name) {
  if (name === "login_redirect") return { role: "anonymous", viewport: "desktop" };
  if (name === "anonymous_access_denied") return { role: "anonymous_access_negative", viewport: "desktop" };
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

export function browserSessionSensitiveValues(session) {
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
  let latestError = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 12000 });
      await page.waitForLoadState("networkidle", { timeout: 2000 }).catch(() => {});
      return response?.status() || 0;
    } catch (error) {
      latestError = error;
      if (attempt === 0) await page.waitForTimeout(700);
    }
  }
  throw latestError;
}

async function runScenario(browser, name, options, execute) {
  try {
    await execute();
    return scenarioResult(name, "pass", "", options.sensitiveValues);
  } catch (error) {
    return scenarioResult(name, "fail", error instanceof Error ? error.message : String(error), options.sensitiveValues);
  }
}

function safeTextPattern(value) {
  const text = cleanIdentifier(value);
  return text ? new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;
}

function ownerScenarioResult(name, status, error = "", sensitiveValues = []) {
  return projectBrowserScenarioResult({
    name,
    role: "owner",
    viewport: "desktop",
    status,
    screenshotPath: null,
    error,
  }, sensitiveValues);
}

function ownerScenarioPrerequisite({ playwright, fixture }) {
  return classifyBrowserPrerequisites({ playwright: Boolean(playwright?.chromium), fixture });
}

function mutationAllowed(value) {
  return value === true || cleanIdentifier(value).toLowerCase() === "true" || cleanIdentifier(value) === "1";
}

function roleAgentRunsPath(projectId) {
  const id = cleanIdentifier(projectId);
  if (!id) throw new Error("missing_role_agent_project_fixture");
  return `/api/projects/${encodeURIComponent(id)}/role-agent-runs`;
}

export async function installStrictRoleAgentErrorRoute(page, { projectId, release } = {}) {
  const expectedPath = roleAgentRunsPath(projectId);
  await page.route("**/*", async (route) => {
    const request = route.request();
    const method = cleanIdentifier(request.method()).toUpperCase();
    if (method === "GET" || method === "HEAD") return route.continue();
    let pathname = "";
    try {
      pathname = new URL(request.url()).pathname;
    } catch {}
    if (method === "POST" && pathname === expectedPath) {
      if (typeof release === "function") await release();
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "qa_safe_server_error" }) });
    }
    return route.abort("blockedbyclient");
  });
}

async function openOwnerProject(browser, options) {
  const { context, page } = await openPage(browser, {
    ...options,
    viewport: CUSTOMER_VIEWPORT,
    customerSession: options.fixture.owner,
  });
  const projectApiPath = `/api/projects/${encodeURIComponent(options.fixture.projectId)}`;
  const projectDataReady = typeof page.waitForResponse === "function"
    ? page.waitForResponse((response) => {
      let pathname = "";
      try { pathname = new URL(response.url()).pathname; } catch {}
      return response.status() === 200 && pathname === projectApiPath;
    }, { timeout: 30000 }).catch(() => null)
    : Promise.resolve(null);
  const status = await visit(page, `${options.origin}/app/projects/${encodeURIComponent(options.fixture.projectId)}`);
  if (status !== 200) {
    await context.close();
    throw new Error(`unexpected_owner_project_status=${status}`);
  }
  await projectDataReady;
  await requireVisible(page.getByRole("heading", { name: /role agent guardrails/i }).first(), "role_agent_guardrails");
  return { context, page };
}

async function ensureCustomerAccountAccess(page) {
  const access = page.getByLabel(/customer account access|客户账号权限/i).first();
  await requireVisible(access, "customer_account_access");
  await access.selectOption("token_or_customer_account");
  await page.waitForTimeout(150);
}

async function addDisposableInvite(page, email) {
  const emailInput = page.getByLabel(/invite customer email|客户邀请邮箱/i).first();
  await requireVisible(emailInput, "invite_customer_email");
  await emailInput.fill(email);
  await page.getByRole("button", { name: /add invite|添加邀请/i }).click();
  await requireVisible(page.getByText(email, { exact: true }).first(), "disposable_invite");
}

export function isRevokedCustomerAccessDenied(status) {
  return status === 401 || status === 404;
}

async function verifyRevokedCustomerAccess(browser, options, session) {
  const { context, page } = await openPage(browser, {
    ...options,
    viewport: CUSTOMER_VIEWPORT,
    customerSession: session,
  });
  try {
    await visit(page, `${options.origin}/login?next=/client`);
    let status = 0;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      status = await page.evaluate(async (path) => {
        const response = await fetch(path);
        return response.status;
      }, `/api/client-portal/projects/${encodeURIComponent(options.fixture.projectId)}`);
      if (isRevokedCustomerAccessDenied(status)) return;
      await page.waitForTimeout(300);
    }
    if (!isRevokedCustomerAccessDenied(status)) {
      throw new Error(`expected_revoked_customer_access_denied_status=401_or_404 actual=${status}`);
    }
  } finally {
    await context.close();
  }
}

function ownerBlockedResults(reason, sensitiveValues) {
  return ownerScenarioNames().map((name) => ownerScenarioResult(name, "blocked", reason, sensitiveValues));
}

/**
 * Owner checks only create or revoke an explicitly named disposable invite
 * when SIGNALHIRE_QA_ALLOW_MUTATIONS=true. Role Agent error/busy checks use
 * Playwright route interception and never send a request to the live server.
 */
export async function runOwnerBrowserScenarios({ playwright, fixture = {}, origin, headers = {}, allowMutations = false } = {}) {
  const prerequisite = ownerScenarioPrerequisite({ playwright, fixture });
  const sensitiveValues = [
    ...browserSessionSensitiveValues(fixture.owner),
    ...browserSessionSensitiveValues(fixture.customer),
    ...browserSessionSensitiveValues(fixture.disposableCustomerSession),
    ...Object.values(headers),
  ].filter((value) => typeof value === "string");
  if (prerequisite.status !== "ready") return ownerBlockedResults(prerequisite.reason, sensitiveValues);

  const options = {
    fixture,
    origin: cleanIdentifier(origin).replace(/\/+$/, ""),
    headers,
    sensitiveValues,
  };
  const browser = await playwright.chromium.launch({ headless: true });
  const results = [];
  const disposableEmail = cleanIdentifier(fixture.disposableCustomerEmail).toLowerCase();
  const disposableCustomerSession = cleanIdentifier(fixture.disposableCustomerSession);
  const successCta = safeTextPattern(fixture.roleAgentSuccessCta);
  const errorCta = safeTextPattern(fixture.roleAgentErrorCta);
  try {
    results.push(await runScenario(browser, "client_access_settings", options, async () => {
      const { context, page } = await openOwnerProject(browser, options);
      try {
        await requireVisible(page.getByLabel(/customer account access|客户账号权限/i).first(), "customer_account_access");
        await requireVisible(page.getByLabel(/allowed customer emails|允许的客户邮箱/i).first(), "allowed_customer_emails");
      } finally {
        await context.close();
      }
    }).then((result) => ownerScenarioResult(result.name, result.status, result.error, sensitiveValues)));

    for (const name of ["invite", "revoke"]) {
      if (!mutationAllowed(allowMutations)) {
        results.push(ownerScenarioResult(name, "blocked", "mutations_not_enabled", sensitiveValues));
      } else if (!disposableEmail) {
        results.push(ownerScenarioResult(name, "blocked", "missing_disposable_customer_fixture", sensitiveValues));
      } else if (name === "revoke" && !disposableCustomerSession) {
        results.push(ownerScenarioResult(name, "blocked", "missing_disposable_customer_session_fixture", sensitiveValues));
      } else {
        results.push(await runScenario(browser, name, options, async () => {
          const { context, page } = await openOwnerProject(browser, options);
          try {
            await ensureCustomerAccountAccess(page);
            await addDisposableInvite(page, disposableEmail);
            if (name === "revoke") {
              const inviteRow = page.getByText(disposableEmail, { exact: true }).first().locator("..").locator("..");
              await inviteRow.getByRole("button", { name: /revoke|撤销/i }).click();
              await requireVisible(inviteRow.getByText(/revoked|已撤销/i).first(), "revoked_disposable_invite");
              await verifyRevokedCustomerAccess(browser, options, disposableCustomerSession);
            }
          } finally {
            await context.close();
          }
        }).then((result) => ownerScenarioResult(result.name, result.status, result.error, sensitiveValues)));
      }
    }

    if (!mutationAllowed(allowMutations)) {
      results.push(ownerScenarioResult("role_agent_success", "blocked", "mutations_not_enabled", sensitiveValues));
    } else if (!successCta) {
      results.push(ownerScenarioResult("role_agent_success", "blocked", "missing_role_agent_success_fixture", sensitiveValues));
    } else {
      results.push(await runScenario(browser, "role_agent_success", options, async () => {
        const { context, page } = await openOwnerProject(browser, options);
        try {
          const action = page.getByRole("button", { name: successCta }).first();
          await requireVisible(action, "role_agent_success_action");
          await action.click();
          await requireVisible(page.locator("p.text-emerald-700").first(), "role_agent_success_copy");
        } finally {
          await context.close();
        }
      }).then((result) => ownerScenarioResult(result.name, result.status, result.error, sensitiveValues)));
    }

    if (!errorCta) {
      results.push(ownerScenarioResult("role_agent_error", "blocked", "missing_role_agent_error_fixture", sensitiveValues));
      results.push(ownerScenarioResult("role_agent_disabled", "blocked", "missing_role_agent_error_fixture", sensitiveValues));
    } else {
      results.push(await runScenario(browser, "role_agent_error", options, async () => {
        const { context, page } = await openOwnerProject(browser, options);
        try {
          await installStrictRoleAgentErrorRoute(page, { projectId: fixture.projectId });
          const action = page.getByRole("button", { name: errorCta }).first();
          await requireVisible(action, "role_agent_error_action");
          await action.click();
          await requireVisible(page.getByText("qa_safe_server_error", { exact: true }).first(), "safe_role_agent_error_copy");
        } finally {
          await context.close();
        }
      }).then((result) => ownerScenarioResult(result.name, result.status, result.error, sensitiveValues)));

      results.push(await runScenario(browser, "role_agent_disabled", options, async () => {
        const { context, page } = await openOwnerProject(browser, options);
        try {
          let release;
          const delayedResponse = new Promise((resolve) => { release = resolve; });
          await installStrictRoleAgentErrorRoute(page, { projectId: fixture.projectId, release: () => delayedResponse });
          const action = page.getByRole("button", { name: errorCta }).first();
          await requireVisible(action, "role_agent_busy_action");
          await action.click();
          await action.waitFor({ state: "visible", timeout: 1000 });
          if (!await action.isDisabled()) throw new Error("expected_role_agent_action_disabled_while_busy");
          release();
          await requireVisible(page.getByText("qa_safe_server_error", { exact: true }).first(), "busy_role_agent_error_copy");
        } finally {
          await context.close();
        }
      }).then((result) => ownerScenarioResult(result.name, result.status, result.error, sensitiveValues)));
    }
    return results;
  } finally {
    await browser.close();
  }
}

function requireVisible(locator, label) {
  return locator.waitFor({ state: "visible", timeout: 12000 }).catch(() => {
    throw new Error(`expected_${label}`);
  });
}

export async function runCustomerFeedbackMutation({ page, allowMutations = false, feedbackFixture = "" } = {}) {
  if (!mutationAllowed(allowMutations)) return { status: "blocked", reason: "mutations_not_enabled" };
  const noteText = cleanIdentifier(feedbackFixture);
  if (!noteText) return { status: "blocked", reason: "missing_feedback_fixture" };

  const feedbackTab = page.getByRole("button", { name: /feedback|反馈/i }).first();
  await requireVisible(feedbackTab, "feedback_tab");
  await feedbackTab.click();
  const note = page.locator("textarea").first();
  await requireVisible(note, "feedback_note");
  await note.fill(noteText);
  await page.getByRole("button", { name: /send feedback|提交反馈/i }).click();
  await page.waitForFunction(() => document.querySelector("textarea")?.value === "", { timeout: 5000 });
  return { status: "pass", reason: "" };
}

/** Runs customer-facing browser checks. */
export async function runCustomerBrowserScenarios({ playwright, fixture, origin, headers = {}, allowMutations = false } = {}) {
  const prerequisite = classifyBrowserPrerequisites({ playwright: Boolean(playwright?.chromium), fixture });
  const normalizedFixture = buildQaFixture(fixture);
  const sensitiveValues = [
    ...browserSessionSensitiveValues(fixture?.owner),
    ...browserSessionSensitiveValues(fixture?.customer),
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
          /interview-ready|可约面/i,
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

    const feedbackFixture = cleanIdentifier(fixture?.feedbackNote);
    if (!mutationAllowed(allowMutations)) {
      results.push(scenarioResult("feedback", "blocked", "mutations_not_enabled", sensitiveValues));
    } else if (!normalizedFixture.reportId || !feedbackFixture) {
      results.push(scenarioResult("feedback", "blocked", "missing_feedback_fixture", sensitiveValues));
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
          const result = await runCustomerFeedbackMutation({ page, allowMutations, feedbackFixture });
          if (result.status !== "pass") throw new Error(result.reason);
        } finally {
          await context.close();
        }
      }));
    }

    results.push(await runScenario(browser, "anonymous_access_denied", options, async () => {
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
