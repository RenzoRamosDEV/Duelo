import { ApiError } from "./apiError";

/**
 * Texto para una llamada fallida: lo que no sea `ApiError` queda genérico, un fallo de red (sin
 * status) habla por sí mismo, `overrides` da a cada formulario su texto por código, y el resto
 * nombra la acción y lleva el mensaje del servidor.
 */
export function apiErrorMessage(
  error: unknown,
  overrides: Partial<Record<number, string>>,
  action: string,
): string {
  if (!(error instanceof ApiError)) return "Ocurrió un error inesperado.";
  if (error.status === null) return error.message;
  const override = overrides[error.status];
  if (override !== undefined) return override;
  if (error.status === 401) return "Token de ingesta no válido.";
  return `No se pudo ${action}: ${error.message}`;
}
