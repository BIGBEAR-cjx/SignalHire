function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {{ initialInput?: string | null; projectId?: string | null }} input
 */
export function shouldAutoRunInitialSearch({ initialInput, projectId } = {}) {
  return Boolean(cleanString(initialInput) && !cleanString(projectId));
}
