import { useCallback } from "react";
import { useAsync } from "../hooks/useAsync";
import type { DataSource } from "./dataSource";
import { createHttpSource } from "./http";
import { createMockSource } from "./mock";

/** URL de la API; sin ella el front enseña los datos de ejemplo. */
export const apiUrl: string | undefined = import.meta.env.VITE_API_URL;

const source: DataSource = apiUrl ? createHttpSource(apiUrl) : createMockSource();

export function useDataSource(): DataSource {
  return source;
}

/** Una sola petición compartida; si falla se olvida, para que el siguiente montaje vuelva a pedir. */
let agentNamesRequest: Promise<string[]> | null = null;

function sharedAgentNames(): Promise<string[]> {
  if (!agentNamesRequest) {
    agentNamesRequest = source.health().then((health) => health.agentNames);
    agentNamesRequest.catch(() => {
      agentNamesRequest = null;
    });
  }
  return agentNamesRequest;
}

/** Agentes configurados en el backend, o `null` mientras no se sepan (cargando o fallo). */
export function useAgentNames(): string[] | null {
  const state = useAsync(useCallback(() => sharedAgentNames(), []));
  return state.status === "ready" ? state.data : null;
}
