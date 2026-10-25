import { ApiError } from "./apiError";
import type { DataSource, ReadOptions } from "./dataSource";
import {
  type AgentStatDto,
  type ChangeDetailDto,
  type ChangePageDto,
  type HealthDto,
  type ProjectDto,
  type RetryDto,
  type SyncPrsDto,
  toAgentStat,
  toChange,
  toChangeDetail,
  toHealth,
  toProject,
} from "./mappers";

/** Cuánto puede tardar una petición antes de abortarla (ms). */
export const REQUEST_TIMEOUT_MS = 10_000;

/** El slug puede llevar «/» (`owner/repo`); las rutas del backend lo aceptan como path. */
const slugPath = (slug: string) => slug.split("/").map(encodeURIComponent).join("/");

/** FastAPI envía `detail` como texto en los errores de aplicación y como lista en los de validación. */
async function errorDetail(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    const detail = (body as { detail?: unknown } | null)?.detail;
    return typeof detail === "string" && detail.trim() ? detail : null;
  } catch {
    return null;
  }
}

/** La fuente de datos real: la API de Duelo en `baseUrl`. Es el único sitio del front con `fetch`. */
export function createHttpSource(baseUrl: string): DataSource {
  const root = baseUrl.replace(/\/+$/, "");

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const deadline = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = init.signal ? AbortSignal.any([init.signal, deadline]) : deadline;
    /** El abort del llamador se relanza tal cual, para distinguir una cancelación de un fallo. */
    function abortError(error: unknown): unknown {
      if (init.signal?.aborted) return error;
      if (deadline.aborted) return new ApiError("El servidor no respondió a tiempo.", null);
      return null;
    }

    let response: Response;
    try {
      response = await fetch(`${root}${path}`, {
        ...init,
        signal,
        headers: { Accept: "application/json", ...init.headers },
      });
    } catch (error) {
      throw abortError(error) ?? new ApiError("No se pudo conectar con el servidor.", null);
    }
    if (!response.ok) {
      const detail = await errorDetail(response);
      throw new ApiError(detail ?? `El servidor respondió ${response.status}.`, response.status);
    }
    if (response.status === 204) return undefined as T;
    try {
      return (await response.json()) as T;
    } catch (error) {
      throw abortError(error) ?? new ApiError("Respuesta no válida del servidor.", response.status);
    }
  }
  const get = <T>(path: string, { signal }: ReadOptions = {}) => request<T>(path, { signal });
  const withToken = (token: string, json = false) => ({
    "X-Ingest-Token": token,
    ...(json ? { "Content-Type": "application/json" } : {}),
  });

  return {
    async projects(options) {
      const projects = await get<ProjectDto[]>("/projects", options);
      return projects.map(toProject);
    },
    async changes(slug, { kind, status, q, cursor, limit } = {}, options = {}) {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      for (const value of status ?? []) params.append("status", value);
      if (q?.trim()) params.set("q", q.trim());
      if (cursor) params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));
      const qs = params.size > 0 ? `?${params}` : "";
      const page = await get<ChangePageDto>(`/projects/${slugPath(slug)}/changes${qs}`, options);
      return { items: page.items.map(toChange), nextCursor: page.next_cursor ?? null };
    },
    async change(id, options) {
      return toChangeDetail(
        await get<ChangeDetailDto>(`/changes/${encodeURIComponent(id)}`, options),
      );
    },
    async agentStats(options) {
      return (await get<AgentStatDto[]>("/stats/agents", options)).map(toAgentStat);
    },
    async health(options) {
      return toHealth(await get<HealthDto>("/health/dependencies", options));
    },
    async retry(id, token) {
      const dto = await request<RetryDto>(`/changes/${encodeURIComponent(id)}/retry`, {
        method: "POST",
        headers: withToken(token),
      });
      return { changeId: dto.change_id, run: dto.run };
    },
    async addProject(path, token) {
      const dto = await request<ProjectDto>("/projects", {
        method: "POST",
        headers: withToken(token, true),
        body: JSON.stringify({ path }),
      });
      return toProject(dto);
    },
    async removeProject(slug, token) {
      await request<void>(`/projects/${slugPath(slug)}`, {
        method: "DELETE",
        headers: withToken(token),
      });
    },
    async setAgents(slug, agents, token) {
      const dto = await request<ProjectDto>(`/projects/${slugPath(slug)}/agents`, {
        method: "PUT",
        headers: withToken(token, true),
        body: JSON.stringify({ agents }),
      });
      return toProject(dto);
    },
    async syncPrs(slug, token) {
      const dto = await request<SyncPrsDto>(`/projects/${slugPath(slug)}/sync-prs`, {
        method: "POST",
        headers: withToken(token),
      });
      return { synced: dto.synced, created: dto.created };
    },
  };
}
