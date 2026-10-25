// Modelo de vista compartido por la interfaz: lo que pintan las páginas, venga de la API o del mock.

/** Id de agente tal cual lo envía la API (texto libre); solo `claude` y `codex` tienen nombre propio. */
export type AgentName = string;
export type ReviewStatus = "running" | "completed" | "failed";
export type ChangeKind = "commit" | "pr";
/** Estado agregado de la review de un change, como lo informa la API (`review_status`). */
export type ReviewAggregate = "pending" | "running" | "partial_failed" | "failed" | "completed";

export interface Finding {
  severity: string;
  file: string;
  line: number;
  message: string;
}

export interface Review {
  id: string;
  agent: AgentName;
  status: ReviewStatus;
  summary?: string;
  findings?: Finding[];
  run?: number;
  durationMs?: number | null;
  score?: number | null;
  /** Motivo del fallo tal cual lo envía el servidor; se sanea antes de mostrarlo. */
  error?: string | null;
  /** Id del change del que se copió esta review (una PR que reutiliza las de su commit). */
  reusedFrom?: string | null;
  /** Versión ligera del listado: sin resumen, hallazgos ni error hasta cargar el detalle. */
  partial?: boolean;
}

/**
 * Qué pasó después con un commit (`commit_state`): `discarded` = ya no está en ninguna rama del
 * repositorio local; `reverted` = otro commit lo deshace con `git revert`. Una PR es siempre `active`.
 */
export type CommitState = "active" | "discarded" | "reverted";

export interface RevertedBy {
  id: string;
  sha: string;
}

export interface Change {
  id: string;
  kind: ChangeKind;
  title: string;
  author: string;
  /** SHA completo; `shortSha` para mostrarlo. */
  sha: string;
  ref: string;
  url: string;
  /** ISO; ausente si la fuente no lo informa. */
  createdAt?: string;
  diff: string;
  truncated?: boolean;
  run?: number;
  reviewStatus?: ReviewAggregate;
  /** Ausente (= `active`) si la fuente no lo informa. */
  commitState?: CommitState;
  /** Solo con `commitState` = `reverted` y el commit que revierte conocido. */
  revertedBy?: RevertedBy;
  /** Ausente si la fuente no informa reviews (el listado del canal sí trae las ligeras). */
  reviews?: Review[];
}

export interface AgentStat {
  agent: string;
  total: number;
  completed: number;
  failed: number;
  avgDurationMs: number | null;
  avgScore: number | null;
}

export interface DependencyHealth {
  /** Nombre de máquina que envía el servidor, p. ej. `postgres`. */
  name: string;
  status: "ok" | "unavailable";
  latencyMs: number;
  reason?: "timeout" | "error";
}

export interface Health {
  status: "ok" | "degraded";
  dependencies: DependencyHealth[];
  /** Agentes configurados en el backend (`AGENT_NAMES`); vacío si el servidor no lo dice. */
  agentNames: string[];
}

export interface ProjectRef {
  slug: string;
  name: string;
  /** Ruta absoluta del repositorio local, si se añadió desde disco. */
  path?: string;
  hooksInstalled?: boolean;
  /** El repositorio está en GitHub, así que sus PRs se pueden sincronizar. */
  github?: boolean;
  /** Agentes que revisan el proyecto; ausente si el servidor no lo informa. */
  agents?: string[];
}

/** Proyecto del mock: lleva sus changes dentro. */
export interface MockProject {
  slug: string;
  name: string;
  changes: Change[];
}

export interface SyncResult {
  synced: number;
  created: number;
}

export interface ChangePage {
  items: Change[];
  nextCursor: string | null;
}

export interface ChangeQuery {
  kind?: ChangeKind;
  /** Estados a conservar; va como parámetro `status` repetido. */
  status?: readonly ReviewAggregate[];
  /** Búsqueda libre (título, autor, SHA o rama); en blanco se ignora. */
  q?: string;
  cursor?: string | null;
  limit?: number;
}

export interface RetryResult {
  changeId: string;
  run: number;
}

/** Mensaje de error de un formulario y el campo al que se refiere (`null` si a ninguno). */
export interface FormError<Field extends string> {
  text: string;
  field: Field | null;
}
