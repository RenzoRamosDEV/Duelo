/**
 * Text for the "last updated" indicator. Under 5 s it says "ahora" so a ticking counter does not
 * distract; afterwards seconds, then minutes, then hours.
 */
export function updatedAgo(seconds: number): string {
  if (seconds < 5) return "Actualizado ahora";
  if (seconds < 60) return `Actualizado hace ${Math.floor(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Actualizado hace ${minutes} min`;
  return `Actualizado hace ${Math.floor(minutes / 60)} h`;
}

export interface LivenessSnapshot {
  /** When the data shown was last loaded, as epoch ms; `null` until the first load. */
  updatedAt: number | null;
  /** The last background refresh failed; the previous data is still shown. */
  refreshFailed: boolean;
}

/**
 * When a live page was last refreshed and whether that failed, kept outside React state so a
 * refresh that brings the same data re-renders only the indicator that subscribes to it.
 */
export interface Liveness {
  get(): LivenessSnapshot;
  set(patch: Partial<LivenessSnapshot>): void;
  subscribe(listener: () => void): () => void;
}

const INITIAL: LivenessSnapshot = { updatedAt: null, refreshFailed: false };

export function createLiveness(): Liveness {
  let snapshot = INITIAL;
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set(patch) {
      const next = { ...snapshot, ...patch };
      if (next.updatedAt === snapshot.updatedAt && next.refreshFailed === snapshot.refreshFailed) {
        return;
      }
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
