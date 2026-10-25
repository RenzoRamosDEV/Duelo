import { useCallback, useEffect, useRef, useState } from "react";
import { type Liveness, createLiveness } from "../utils/liveness";

export type AsyncState<T> =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; data: T };

export interface AsyncOptions<T> {
  /** Periodo del refresco silencioso en ms; `0` o ausente lo desactiva. */
  pollMs?: number;
  /** El sondeo sigue solo mientras esto devuelva cierto para los datos que se ven. */
  pollWhile?: (data: T) => boolean;
  /** Un refresco con un valor igual conserva el objeto anterior (sin repintar, sin parpadeo). */
  equals?: (previous: T, next: T) => boolean;
}

export interface AsyncResult {
  retry: () => void;
  /** Recarga en segundo plano ahora mismo: sin estado de carga, los datos anteriores quedan si falla. */
  refresh: () => void;
  /** Cuándo se cargaron los datos y si el último refresco falló; referencia estable. */
  liveness: Liveness;
}

/**
 * Ejecuta `load` cada vez que cambia; la petición anterior se aborta por su señal y su resultado
 * se ignora. `retry` la repite desde cero (vuelve a cargando). Con `pollMs` además refresca en
 * segundo plano: nunca solapado, pausado con la pestaña oculta y refrescando al volver.
 */
export function useAsync<T>(
  load: (signal: AbortSignal) => Promise<T>,
  options: AsyncOptions<T> = {},
): AsyncState<T> & AsyncResult {
  const { pollMs = 0 } = options;
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [liveness] = useState(createLiveness);

  // Últimos valores para los callbacks de sondeo, que viven mucho y no deben leer closures viejos.
  const latest = useRef({ state, options });
  latest.current = { state, options };
  const refreshNow = useRef<(force: boolean) => void>(() => {});

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` relanza la carga al reintentar
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setState({ status: "loading" });
    liveness.set({ updatedAt: null, refreshFailed: false });
    load(signal).then(
      (data) => {
        if (signal.aborted) return;
        setState({ status: "ready", data });
        liveness.set({ updatedAt: Date.now() });
      },
      (error) => !signal.aborted && setState({ status: "error", error }),
    );
    return () => controller.abort();
  }, [load, attempt]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` reinicia el sondeo tras un reintento
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let inFlight = false;

    async function refresh(force: boolean) {
      if (signal.aborted || inFlight) return;
      if (!force && document.visibilityState === "hidden") return;
      const { state: shown, options: opts } = latest.current;
      if (shown.status !== "ready") return;
      if (!force && opts.pollWhile && !opts.pollWhile(shown.data)) return;
      inFlight = true;
      try {
        const data = await load(signal);
        if (signal.aborted) return;
        const { state: now, options: current } = latest.current;
        const same = now.status === "ready" && current.equals?.(now.data, data);
        if (!same) setState({ status: "ready", data });
        liveness.set({ updatedAt: Date.now(), refreshFailed: false });
      } catch {
        if (!signal.aborted) liveness.set({ refreshFailed: true });
      } finally {
        inFlight = false;
      }
    }

    refreshNow.current = (force) => void refresh(force);
    if (pollMs <= 0) return () => controller.abort();
    const timer = setInterval(() => void refresh(false), pollMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, attempt, pollMs]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const refresh = useCallback(() => refreshNow.current(true), []);
  return { ...state, retry, refresh, liveness };
}
