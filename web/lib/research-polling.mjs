export const RESEARCH_POLL_INTERVAL_MS = 2_000;
export const RESEARCH_POLL_SLOW_INTERVAL_MS = 30_000;
export const RESEARCH_POLL_SLOW_AFTER_MS = 15 * 60 * 1000;

export function nextResearchPollDelayMs(elapsedMs) {
  return elapsedMs >= RESEARCH_POLL_SLOW_AFTER_MS
    ? RESEARCH_POLL_SLOW_INTERVAL_MS
    : RESEARCH_POLL_INTERVAL_MS;
}

export function buildResearchRunHref({ kind, id, projectId }) {
  const path = kind === "verify" ? "/app/verify" : "/app/search";
  const params = new URLSearchParams({ run: id });
  if (projectId) params.set("project", projectId);
  return `${path}?${params.toString()}`;
}
