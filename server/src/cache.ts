// Tiny in-memory TTL cache. Live facts for a point are slow-changing enough to
// reuse across re-clicks and overlapping scans within the TTL window.

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 5000;

export async function cached<T>(
  key: string,
  ttlMs: number,
  produce: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;

  const value = await produce();

  // Cheap eviction: drop the oldest-ish entries when we grow too large.
  if (store.size >= MAX_ENTRIES) {
    const cutoff = Math.floor(MAX_ENTRIES / 5);
    let i = 0;
    for (const k of store.keys()) {
      store.delete(k);
      if (++i >= cutoff) break;
    }
  }
  store.set(key, { value, expires: now + ttlMs });
  return value;
}

/** Run `fn` over items with at most `limit` in flight at once. */
export async function mapLimit<T>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      await fn(items[i], i);
    }
  });
  await Promise.all(workers);
}
