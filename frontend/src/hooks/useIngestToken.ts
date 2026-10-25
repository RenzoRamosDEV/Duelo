import { useSyncExternalStore } from "react";

/**
 * El token de ingesta vive solo en la memoria de este módulo: sobrevive a la navegación dentro
 * de la pestaña y desaparece al recargar. Nunca va a storage, a la URL ni al build.
 */
let token = "";
const listeners = new Set<() => void>();

export function getIngestToken(): string {
  return token;
}

export function setIngestToken(value: string): void {
  if (value === token) return;
  token = value;
  for (const listener of listeners) listener();
}

export function clearIngestToken(): void {
  setIngestToken("");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIngestToken(): [string, (value: string) => void] {
  return [useSyncExternalStore(subscribe, getIngestToken), setIngestToken];
}
