import { useCallback, useSyncExternalStore } from "react";

/**
 * Efectos retro (scanlines y parpadeo) encendidos o apagados. La preferencia vive en
 * `localStorage` y se refleja en `html.no-effects`; si el almacenamiento está bloqueado, dura
 * hasta cerrar la página.
 */
const STORAGE_KEY = "duelo-effects";
const CLASS_NAME = "no-effects";

const listeners = new Set<() => void>();
let enabled = true;

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function apply(value: boolean) {
  enabled = value;
  document.documentElement.classList.toggle(CLASS_NAME, !value);
  for (const listener of listeners) listener();
}

/** Se llama antes del primer render para que la primera pintura ya respete la preferencia. */
export function applyEffectsPreference(): void {
  apply(readStored());
}

export function setEffectsEnabled(value: boolean): void {
  try {
    if (value) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, "off");
  } catch {
    // Sin almacenamiento la elección dura la sesión.
  }
  apply(value);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => enabled;

export function useEffectsPreference(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const set = useCallback((next: boolean) => setEffectsEnabled(next), []);
  return [value, set];
}
