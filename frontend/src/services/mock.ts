import type { Change, ChangePage, ProjectRef } from "../types";
import { isAbsolutePath, slugFromPath } from "../utils/localPath";
import { aggregateStatus, isRetryable } from "../utils/reviewStatus";
import { matchesQuery } from "../utils/search";
import { ApiError } from "./apiError";
import type { DataSource } from "./dataSource";
import { agentStats, health, projects } from "./mockData";

const DEFAULT_PAGE_SIZE = 50;

/**
 * Sirve los datos de ejemplo con el mismo contrato que la API: cursor = desplazamiento, los mismos
 * filtros `kind`, `status` y `q`, un `reviewStatus` agregado, un reintento que reinicia el change
 * y gestión de proyectos en memoria con las mismas reglas de error (401 sin token, 422 ruta
 * relativa, 409 duplicado, 503 al sincronizar un proyecto que no está en GitHub). Todo se guarda
 * por fuente: los datos compartidos no se mutan.
 */
export function createMockSource(): DataSource {
  const restarted = new Map<string, number>();
  const added: ProjectRef[] = [];
  const removed = new Set<string>();
  const chosen = new Map<string, string[]>();

  function currentProjects(): ProjectRef[] {
    const base = projects.map((p) => ({ slug: p.slug, name: p.name }));
    return [...base, ...added]
      .filter((p) => !removed.has(p.slug))
      .map((p) => {
        const agents = chosen.get(p.slug);
        return agents ? { ...p, agents } : p;
      });
  }

  function requireToken(token: string) {
    if (!token.trim()) throw new ApiError("Token no válido.", 401);
  }

  function requireProject(slug: string): ProjectRef {
    const project = currentProjects().find((p) => p.slug === slug);
    if (!project) throw new ApiError("Proyecto no encontrado.", 404);
    return project;
  }

  function view(change: Change): Change {
    const run = restarted.get(change.id);
    const base = run === undefined ? change : { ...change, reviews: [], run };
    return {
      ...base,
      run: base.run ?? 1,
      reviewStatus: aggregateStatus(base.reviews ?? [], health.agentNames.length),
    };
  }

  function find(id: string): Change | undefined {
    for (const project of projects) {
      const change = project.changes.find((c) => c.id === id);
      if (change) return view(change);
    }
    return undefined;
  }

  return {
    async projects() {
      return currentProjects();
    },
    async changes(slug, { kind, status, q, cursor, limit = DEFAULT_PAGE_SIZE } = {}) {
      requireProject(slug);
      const all = (projects.find((p) => p.slug === slug)?.changes ?? [])
        .map(view)
        .filter((c) => !kind || c.kind === kind)
        .filter((c) => !status?.length || (c.reviewStatus && status.includes(c.reviewStatus)))
        .filter((c) => !q || matchesQuery(c, q));
      const start = cursor ? Number(cursor) : 0;
      const items = all.slice(start, start + limit);
      const end = start + items.length;
      return { items, nextCursor: end < all.length ? String(end) : null } satisfies ChangePage;
    },
    async change(id) {
      const change = find(id);
      if (!change) throw new ApiError("Change no encontrado.", 404);
      return change;
    },
    async agentStats() {
      return agentStats;
    },
    async health() {
      return health;
    },
    async retry(id, token) {
      requireToken(token);
      const change = find(id);
      if (!change) throw new ApiError("Change no encontrado.", 404);
      if (!isRetryable(change.reviewStatus)) throw new ApiError("Nada que reintentar.", 409);
      const run = (change.run ?? 1) + 1;
      restarted.set(id, run);
      return { changeId: id, run };
    },
    async addProject(path, token) {
      requireToken(token);
      if (!isAbsolutePath(path)) throw new ApiError("La ruta debe ser absoluta.", 422);
      const slug = slugFromPath(path);
      if (!slug) throw new ApiError("La ruta no es un repositorio.", 422);
      if (currentProjects().some((p) => p.slug === slug)) {
        throw new ApiError("El proyecto ya existe.", 409);
      }
      removed.delete(slug);
      const project: ProjectRef = {
        slug,
        name: slug,
        path: path.trim(),
        hooksInstalled: true,
        github: false,
      };
      added.push(project);
      return project;
    },
    async removeProject(slug, token) {
      requireToken(token);
      requireProject(slug);
      const index = added.findIndex((p) => p.slug === slug);
      if (index >= 0) added.splice(index, 1);
      else removed.add(slug);
    },
    async setAgents(slug, agents, token) {
      requireToken(token);
      requireProject(slug);
      const valid =
        agents.length > 0 &&
        new Set(agents).size === agents.length &&
        agents.every((a) => health.agentNames.includes(a));
      if (!valid) throw new ApiError("Selección de agentes no válida.", 422);
      // El mismo orden que el servidor: el que define `AGENT_NAMES`.
      chosen.set(
        slug,
        health.agentNames.filter((a) => agents.includes(a)),
      );
      return requireProject(slug);
    },
    async syncPrs(slug, token) {
      requireToken(token);
      const project = requireProject(slug);
      if (!project.github) {
        throw new ApiError("GitHub CLI (`gh`) no está disponible o no has iniciado sesión.", 503);
      }
      return { synced: 0, created: 0 };
    },
  };
}
