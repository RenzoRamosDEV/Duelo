import type {
  AgentStat,
  Change,
  ChangePage,
  ChangeQuery,
  Health,
  ProjectRef,
  RetryResult,
  SyncResult,
} from "../types";

/** Permite cancelar una lectura (salir de la página, cambiar la consulta). */
export interface ReadOptions {
  signal?: AbortSignal;
}

/** Todo lo que la interfaz pide; lo implementan la API real y el mock. */
export interface DataSource {
  projects(options?: ReadOptions): Promise<ProjectRef[]>;
  changes(slug: string, query?: ChangeQuery, options?: ReadOptions): Promise<ChangePage>;
  change(id: string, options?: ReadOptions): Promise<Change>;
  agentStats(options?: ReadOptions): Promise<AgentStat[]>;
  health(options?: ReadOptions): Promise<Health>;
  /** Arranca una run nueva para un change fallido. Rechaza con `ApiError` (401/404/409/503…). */
  retry(id: string, token: string): Promise<RetryResult>;
  /** Da de alta un repositorio git local e instala sus hooks. Rechaza con `ApiError`. */
  addProject(path: string, token: string): Promise<ProjectRef>;
  /** Quita un proyecto, sus hooks y su historial. */
  removeProject(slug: string, token: string): Promise<void>;
  /** Importa las PRs del repositorio con `gh`; 503 si falta o no tiene sesión. */
  syncPrs(slug: string, token: string): Promise<SyncResult>;
  /** Elige qué agentes revisan el proyecto (al menos uno); aplica a lo que llegue después. */
  setAgents(slug: string, agents: readonly string[], token: string): Promise<ProjectRef>;
}
