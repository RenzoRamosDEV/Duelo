import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import type { Health } from "../types";
import type { DataSource } from "./dataSource";
import { createHttpSource } from "./http";
import { createMockSource } from "./mock";

/** URL de la API; sin ella el front enseña los datos de ejemplo. */
export const apiUrl: string | undefined = import.meta.env.VITE_API_URL;

const source: DataSource = apiUrl ? createHttpSource(apiUrl) : createMockSource();

export function useDataSource(): DataSource {
  return source;
}

/** Una sola petición de diagnóstico compartida; si falla se olvida, para que el siguiente montaje vuelva a pedir. */
let healthRequest: Promise<Health> | null = null;

function sharedHealth(): Promise<Health> {
  if (!healthRequest) {
    healthRequest = source.health();
    healthRequest.catch(() => {
      healthRequest = null;
    });
  }
  return healthRequest;
}

/** Agentes configurados en el backend, o `null` mientras no se sepan (cargando o fallo). */
export function useAgentNames(): string[] | null {
  const state = useAsync(useCallback(() => sharedHealth(), []));
  return state.status === "ready" ? state.data.agentNames : null;
}

export type ApiStatus = "mock" | "loading" | "ok" | "degraded" | "offline";

/** Estado de la conexión con la API para el pie de la barra lateral; no hace peticiones nuevas. */
export function useApiStatus(): ApiStatus {
  const state = useAsync(useCallback(() => sharedHealth(), []));
  if (!apiUrl) return "mock";
  if (state.status === "loading") return "loading";
  if (state.status === "error") return "offline";
  return state.data.status === "ok" ? "ok" : "degraded";
}
