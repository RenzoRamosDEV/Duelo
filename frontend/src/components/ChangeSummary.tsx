import type { Change, Review } from "../types";
import { agentLabel } from "../utils/agents";
import { formatDuration, formatScore } from "../utils/format";
import { AGGREGATE_LABEL, AGGREGATE_TONE } from "../utils/reviewStatus";
import { AgentTag } from "./AgentTag";
import { RetryReview } from "./RetryReview";
import { StatusBadge } from "./StatusBadge";
import { Card } from "./ui/Card";
import { StatusIcon } from "./ui/StatusIcon";

interface Props {
  change: Change;
  /** Reviews de la run actual, ordenadas por agente. */
  reviews: Review[];
  /** Agentes esperados que aún no han entregado (o `null` si no se conocen). */
  pending: readonly string[] | null;
  retryable: boolean;
  onRetried: (message: string) => void;
}

/** Tarjeta de resumen del change: veredicto, estado por agente, duración y nota, y el reintento. */
export function ChangeSummary({ change, reviews, pending, retryable, onRetried }: Props) {
  const rows = [
    ...reviews.map((review) => ({ agent: review.agent, review })),
    ...(pending ?? []).map((agent) => ({ agent, review: null })),
  ].sort((a, b) => a.agent.localeCompare(b.agent));
  return (
    <Card title="Resumen" className="summary">
      <div className="stack">
        {change.reviewStatus && (
          <div className="summary-verdict">
            <span className="label">Veredicto</span>
            <StatusBadge status={change.reviewStatus} />
          </div>
        )}
        {rows.length > 0 && (
          <ul className="summary-agents" aria-label="Estado por agente">
            {rows.map(({ agent, review }) => (
              <li key={agent} className="summary-agent">
                <span className="summary-agent-name">
                  <StatusIcon
                    tone={review ? AGGREGATE_TONE[review.status] : "warn"}
                    label={review ? AGGREGATE_LABEL[review.status] : "En curso"}
                  />
                  <AgentTag agent={agent} />
                  <span>{agentLabel(agent)}</span>
                </span>
                <span className="summary-agent-data meta">
                  {review?.durationMs != null && <span>{formatDuration(review.durationMs)}</span>}
                  {review?.score != null && <span>Nota {formatScore(review.score)}</span>}
                  {!review && <span>revisando…</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {pending === null && rows.length === 0 && <p className="meta">Esperando a los agentes…</p>}
        {retryable && <RetryReview changeId={change.id} onSettled={onRetried} />}
      </div>
    </Card>
  );
}
