// View model shared by the UI: what the pages render, whatever the data source.

/** Agent id as sent by the API (free text); only `claude` and `codex` have a proper display name. */
export type AgentName = string;
export type ReviewStatus = "running" | "completed" | "failed";
export type ChangeKind = "commit" | "pr";
/** Aggregate review state of a change, as reported by the API (`review_status`). */
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
  /** Failure reason as sent by the server; sanitize it before showing it. */
  error?: string | null;
  /** Id of the change this review was copied from (a PR reusing its identical commit's). */
  reusedFrom?: string | null;
  /** Light version from the channel listing: no summary, findings or error until the detail loads. */
  partial?: boolean;
}

/**
 * What happened to a commit afterwards, as reported by the API (`commit_state`): `discarded` = it is
 * no longer on any branch of the local repository (reset, amend, rebase…); `reverted` = a later
 * commit undoes it with `git revert`. A PR is always `active`.
 */
export type CommitState = "active" | "discarded" | "reverted";

/** The commit that reverts another one, enough to name and link it. */
export interface RevertedBy {
  id: string;
  sha: string;
}

export interface Change {
  id: string;
  kind: ChangeKind;
  title: string;
  author: string;
  /** Full head SHA; use `shortSha` to display it. */
  sha: string;
  ref: string;
  url: string;
  /** ISO timestamp; absent when the source does not report it. */
  createdAt?: string;
  diff: string;
  truncated?: boolean;
  run?: number;
  reviewStatus?: ReviewAggregate;
  /** Absent (= `active`) when the source does not report it. */
  commitState?: CommitState;
  /** Set only when `commitState` is `reverted` and the reverting commit is known. */
  revertedBy?: RevertedBy;
  /** Absent when the source does not report reviews (the API channel listing). */
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
  /** Machine name sent by the server, e.g. `postgres`. */
  name: string;
  status: "ok" | "unavailable";
  latencyMs: number;
  reason?: "timeout" | "error";
}

export interface Health {
  status: "ok" | "degraded";
  dependencies: DependencyHealth[];
  /** Agents configured in the backend (`AGENT_NAMES`); empty when the server does not say. */
  agentNames: string[];
}

export interface Project {
  slug: string;
  name: string;
  changes: Change[];
}
