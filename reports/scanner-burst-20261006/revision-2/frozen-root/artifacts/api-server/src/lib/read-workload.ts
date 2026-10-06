// Shared admission for expensive catalogue readers. Three product tasks issue
// at most six queries (two cost readers each), leaving room for authentication.
// Queue work in application memory, not thousands of pool.connect waiters.
const MAX_ACTIVE_READ_TASKS = 3;
let active = 0;
const waiting: Array<() => void> = [];

export async function withReadWorkload<T>(work: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE_READ_TASKS) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try { return await work(); }
  finally {
    const next = waiting.shift();
    if (next) next(); // hand this slot directly to the oldest waiter
    else active--;
  }
}

/** Stable input order and full results; errors propagate, no partial/zero fallback. */
export async function mapReadWorkload<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const result = new Array<R>(items.length);
  let cursor = 0;
  let failed = false;
  const worker = async () => {
    while (!failed) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        result[index] = await withReadWorkload(() => work(items[index]));
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(MAX_ACTIVE_READ_TASKS, items.length) }, worker));
  return result;
}