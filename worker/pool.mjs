export const MAX_WORKER_CONCURRENCY = 3;

export function normalizeWorkerConcurrency(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return MAX_WORKER_CONCURRENCY;
  return Math.min(MAX_WORKER_CONCURRENCY, Math.floor(n));
}

export async function fillWorkerPool({
  activeJobs,
  maxConcurrentJobs = MAX_WORKER_CONCURRENCY,
  claimNext,
  runJob,
  onError = () => {},
}) {
  let started = 0;
  while (activeJobs.size < maxConcurrentJobs) {
    const job = await claimNext();
    if (!job) break;
    let task;
    task = Promise.resolve()
      .then(() => runJob(job))
      .catch(onError)
      .finally(() => activeJobs.delete(task));
    activeJobs.add(task);
    started += 1;
  }
  return started;
}

export async function waitForWorkerPool({ activeJobs, sleep, pollMs }) {
  if (activeJobs.size === 0) {
    await sleep(pollMs);
    return;
  }
  await Promise.race([sleep(pollMs), ...activeJobs]);
}
