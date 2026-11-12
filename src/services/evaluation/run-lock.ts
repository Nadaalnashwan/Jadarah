import "server-only";

/**
 * In-process lock: one AI evaluation per submission + question at a time on this server instance. It stops repeated
 * clicks and parallel requests that reach the same instance; proposal 0034 adds the database lock that also covers
 * several instances. A lock older than the evaluation's longest possible duration is ignored (a crashed request never
 * blocks a question).
 */
const g = globalThis as unknown as { __jadarahEvalLocks?: Map<string, number> };
const locks = (g.__jadarahEvalLocks ??= new Map<string, number>());
export const LOCAL_LOCK_MAX_MS = 5 * 60_000;

/** Returns a release function, or null when the key is already locked. */
export function acquireLocalLock(key: string, now = Date.now()): (() => void) | null {
  const held = locks.get(key);
  if (held !== undefined && now - held < LOCAL_LOCK_MAX_MS) return null;
  locks.set(key, now);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (locks.get(key) === now) locks.delete(key);
  };
}
