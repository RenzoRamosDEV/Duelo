import { useSyncExternalStore } from "react";

const REFRESH_MS = 60_000;

/** Un reloj compartido que avanza una vez por minuto: la resolución que necesita «hace 12 min». */
let now = new Date();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => {
    now = new Date();
    for (const l of listeners) l();
  }, REFRESH_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

export function useNow(): Date {
  return useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
}
