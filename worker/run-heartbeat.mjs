export const DEFAULT_RUN_HEARTBEAT_MS = 30_000;

export function startRunHeartbeat({
  db,
  table,
  jobId,
  intervalMs = DEFAULT_RUN_HEARTBEAT_MS,
  setIntervalImpl = setInterval,
  clearIntervalImpl = clearInterval,
}) {
  if (!db || !table || !jobId) return () => {};

  const timer = setIntervalImpl(() => {
    db.from(table)
      .update({ updated_at: new Date().toISOString() })
      .eq("id", jobId)
      .eq("status", "running")
      .then(() => {}, () => {});
  }, intervalMs);

  return () => clearIntervalImpl(timer);
}
