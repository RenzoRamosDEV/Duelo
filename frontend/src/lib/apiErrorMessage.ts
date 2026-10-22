import { ApiError } from "./api";

/**
 * Text for a failed API call: anything that is not an `ApiError` stays generic, a network failure
 * (no status) speaks for itself, `overrides` gives a form its own text per status, and the rest
 * names the action and carries the server's message.
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
