import type { AgentStat, Change, Health, ProjectRef, Review } from "../types";
import type { components } from "./api.generated";

/** El formato de red, generado desde `docs/openapi.json` (`pnpm gen:api`); nunca se edita a mano. */
type Schemas = components["schemas"];
export type ProjectDto = Schemas["ProjectResponse"];
export type SyncPrsDto = Schemas["SyncPrsResponse"];
export type ReviewBriefDto = Schemas["ReviewBriefResponse"];
export type ReviewDto = Schemas["ReviewResponse"];
export type AgentStatDto = Schemas["AgentStatsResponse"];
export type HealthDto = Schemas["DependenciesHealthResponse"];
export type RetryDto = Schemas["RetryReviewResponse"];
export type ChangePageDto = Schemas["ChangePageResponse"];
export type ChangeDetailDto = Schemas["ChangeDetailResponse"];
/** Lo que comparten un item del canal y el detalle; solo el listado trae las `reviews` ligeras. */
export type ChangeSummaryDto = Omit<Schemas["ChangeListItemResponse"], "reviews"> & {
  reviews?: ReviewBriefDto[];
};

export function toProject(dto: ProjectDto): ProjectRef {
  return {
    slug: dto.slug,
    name: dto.slug,
    ...(dto.path ? { path: dto.path } : {}),
    ...(dto.hooks_installed != null ? { hooksInstalled: dto.hooks_installed } : {}),
    ...(dto.github != null ? { github: Boolean(dto.github) } : {}),
    ...(dto.agents ? { agents: dto.agents } : {}),
  };
}

export function toChange(dto: ChangeSummaryDto): Change {
  return {
    id: dto.id,
    kind: dto.kind,
    title: dto.title || dto.ref || dto.head_sha,
    author: dto.author,
    sha: dto.head_sha,
    ref: dto.ref,
    url: dto.url,
    createdAt: dto.created_at,
    diff: "",
    truncated: dto.diff_truncated,
    run: dto.run,
    reviewStatus: dto.review_status,
    // Tolerante a propósito: un servidor anterior a este campo significa un change normal.
    commitState: dto.commit_state ?? "active",
    ...(dto.reverted_by
      ? { revertedBy: { id: dto.reverted_by.id, sha: dto.reverted_by.head_sha } }
      : {}),
    ...(dto.reviews ? { reviews: dto.reviews.map((b) => toBrief(dto.id, b)) } : {}),
  };
}

/** El listado no trae ids de review: un change tiene una por agente y run, y esa es la clave. */
function toBrief(changeId: string, dto: ReviewBriefDto): Review {
  return {
    id: `${changeId}:${dto.agent}:${dto.run}`,
    agent: dto.agent,
    status: dto.status,
    run: dto.run,
    score: dto.score,
    durationMs: dto.duration_ms,
    reusedFrom: dto.reused_from ?? null,
    partial: true,
  };
}

export function toReview(dto: ReviewDto): Review {
  return {
    id: dto.id,
    agent: dto.agent,
    status: dto.status,
    summary: dto.summary ?? undefined,
    findings: dto.findings,
    run: dto.run,
    score: dto.score,
    durationMs: dto.duration_ms,
    error: dto.error,
    reusedFrom: dto.reused_from ?? null,
  };
}

export function toChangeDetail(dto: ChangeDetailDto): Change {
  return {
    ...toChange({ ...dto, reviews: undefined }),
    diff: dto.diff,
    reviews: dto.reviews.map(toReview),
  };
}

export function toAgentStat(dto: AgentStatDto): AgentStat {
  return {
    agent: dto.agent,
    total: dto.total,
    completed: dto.completed,
    failed: dto.failed,
    avgDurationMs: dto.avg_duration_ms,
    avgScore: dto.avg_score,
  };
}

export function toHealth(dto: HealthDto): Health {
  return {
    status: dto.status,
    dependencies: Object.entries(dto.dependencies)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, d]) => ({
        name,
        status: d.status,
        latencyMs: d.latency_ms,
        reason: d.reason ?? undefined,
      })),
    agentNames: dto.agent_names ?? [],
  };
}
