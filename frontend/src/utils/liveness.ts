/**
 * Texto del indicador «última actualización». Por debajo de 5 s dice «ahora» para que un contador
 * no distraiga; después segundos, minutos y horas.
 */
export function updatedAgo(seconds: number): string {
  if (seconds < 5) return "Actualizado ahora";
  if (seconds < 60) return `Actualizado hace ${Math.floor(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Actualizado hace ${minutes} min`;
  return `Actualizado hace ${Math.floor(minutes / 60)} h`;
}

export interface LivenessSnapshot {
  /** Cuándo se cargaron los datos que se ven, en ms de época; `null` hasta la primera carga. */
  updatedAt: number | null;
  /** El último refresco en segundo plano falló; se siguen viendo los datos anteriores. */
  refreshFailed: boolean;
}

/**
 * Cuándo se refrescó una página viva y si falló, fuera del estado de React para que un refresco
 * con los mismos datos solo vuelva a pintar el indicador que se suscribe.
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
