import type { ReactNode } from "react";
import type { AsyncState } from "../hooks/useAsync";
import { ApiError } from "../services/apiError";
import { ErrorMessage } from "./ui/ErrorMessage";
import { Loader } from "./ui/Loader";

interface Props<T> {
  state: AsyncState<T> & { retry: () => void };
  loadingLabel: string;
  /** Esqueleto decorativo bajo la etiqueta de carga. */
  skeleton?: ReactNode;
  /** Se muestra en lugar del error genérico cuando la petición respondió 404. */
  notFound?: ReactNode;
  children: (data: T) => ReactNode;
}

/** Pinta cargando / error recuperable / no encontrado alrededor de un valor cargado. */
export function AsyncBoundary<T>({ state, loadingLabel, skeleton, notFound, children }: Props<T>) {
  if (state.status === "loading") {
    return (
      <>
        <Loader label={loadingLabel} />
        {skeleton}
      </>
    );
  }
  if (state.status === "error") {
    if (notFound && state.error instanceof ApiError && state.error.notFound) return <>{notFound}</>;
    const message =
      state.error instanceof Error ? state.error.message : "Ocurrió un error inesperado.";
    return <ErrorMessage message={message} onRetry={state.retry} />;
  }
  return <>{children(state.data)}</>;
}
