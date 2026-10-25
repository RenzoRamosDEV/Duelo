import type { ReviewAggregate } from "../types";

/** El filtro de estado del canal tal como lo ve el usuario. */
export type StateFilter = "all" | "running" | "failed" | "completed";

const STATUSES: Record<Exclude<StateFilter, "all">, ReviewAggregate[]> = {
  running: ["pending", "running"],
  failed: ["failed", "partial_failed"],
  completed: ["completed"],
};

/** Valores `status` del servidor para un filtro; `undefined` para «Todos» (no se envía). */
export function statusesFor(filter: StateFilter): ReviewAggregate[] | undefined {
  return filter === "all" ? undefined : STATUSES[filter];
}
