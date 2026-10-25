import type { Review, ReviewAggregate } from "../types";

/**
 * Reproduce el `review_status` del backend para los datos de ejemplo. `expected` es el número de
 * agentes configurados. Una review `running` no existe en la API (solo se guardan las terminadas),
 * así que en el mock deja el change en `running`.
 */
export function aggregateStatus(reviews: readonly Review[], expected: number): ReviewAggregate {
  if (reviews.some((r) => r.status === "running")) return "running";
  const failed = reviews.filter((r) => r.status === "failed").length;
  const total = reviews.length;
  if (total === 0) return "pending";
  if (total < expected) return "running";
  if (failed === 0) return "completed";
  return failed === total ? "failed" : "partial_failed";
}

/** Estados desde los que el backend acepta un reintento. */
export function isRetryable(status: ReviewAggregate | undefined): boolean {
  return status === "failed" || status === "partial_failed";
}

/** Un change en estos estados sigue esperando reviews. */
export function isWaiting(status: ReviewAggregate | undefined): boolean {
  return status === "pending" || status === "running";
}

export const AGGREGATE_LABEL: Record<ReviewAggregate, string> = {
  pending: "Pendiente",
  running: "En curso",
  partial_failed: "Fallo parcial",
  failed: "Fallida",
  completed: "Completada",
};

export type Tone = "neutral" | "ok" | "alert";

export const AGGREGATE_TONE: Record<ReviewAggregate, Tone> = {
  pending: "neutral",
  running: "neutral",
  partial_failed: "alert",
  failed: "alert",
  completed: "ok",
};

/** Glifo monospace que acompaña al texto del estado, para que no dependa solo del color. */
export const AGGREGATE_GLYPH: Record<ReviewAggregate, string> = {
  pending: "·",
  running: "…",
  partial_failed: "!",
  failed: "✕",
  completed: "✓",
};
