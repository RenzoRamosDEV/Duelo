import type { Review } from "../types";
import { agentLabel } from "../utils/agents";
import { findingFile, findingLine, severityRank } from "../utils/findings";
import { formatDuration, formatScore } from "../utils/format";
import { sanitizeError } from "../utils/sanitize";
import { shortSha } from "../utils/url";
import { AgentTag } from "./AgentTag";
import { Collapsible, SUMMARY_LIMIT, isLong } from "./Collapsible";
import { FindingCard } from "./FindingCard";
import { Markdown } from "./Markdown";
import { StatusBadge } from "./StatusBadge";
import { Badge } from "./ui/Badge";
import { Loader } from "./ui/Loader";

/** Los metadatos de una review: run, duración y nota. */
function Meta({ review }: { review: Review }) {
  const items = [
    review.run !== undefined && `Run ${review.run}`,
    review.durationMs != null && formatDuration(review.durationMs),
    review.score != null && `Nota ${formatScore(review.score)}`,
  ].filter((item): item is string => typeof item === "string");
  if (items.length === 0) return null;
  return (
    <ul className="review-meta" aria-label="Datos de la review">
      {items.map((item) => (
        <li key={item}>
          <Badge>{item}</Badge>
        </li>
      ))}
    </ul>
  );
}

/** Lo más grave primero, luego por archivo y línea, para leer desde lo que más importa. */
function orderedFindings(review: Review) {
  return (review.findings ?? [])
    .map((finding, index) => ({ finding, key: `${review.id}-f${index}` }))
    .sort(
      (a, b) =>
        severityRank(a.finding.severity) - severityRank(b.finding.severity) ||
        (findingFile(a.finding) ?? "￿").localeCompare(findingFile(b.finding) ?? "￿") ||
        (findingLine(a.finding) ?? Number.POSITIVE_INFINITY) -
          (findingLine(b.finding) ?? Number.POSITIVE_INFINITY),
    );
}

function Completed({ review, showFindings }: { review: Review; showFindings: boolean }) {
  const findings = orderedFindings(review);
  const summary = review.summary?.trim();
  return (
    <>
      {summary && (
        <section className="review-section" aria-label="Resumen">
          <h4 className="section-label">Resumen</h4>
          <Collapsible id={`summary:${review.id}`} long={isLong(summary, SUMMARY_LIMIT)}>
            <Markdown text={summary} />
          </Collapsible>
        </section>
      )}
      {findings.length === 0 && <p className="no-findings">✓ Sin hallazgos</p>}
      {showFindings && findings.length > 0 && (
        <section className="review-section" aria-label="Hallazgos">
          <h4 className="section-label">
            Hallazgos <span className="count">{findings.length}</span>
          </h4>
          <ul className="finding-list">
            {findings.map(({ finding, key }) => (
              <li key={key}>
                <FindingCard id={key} finding={finding} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/**
 * Una PR idéntica a un commit ya revisado reutiliza sus reviews en lugar de volver a preguntar a
 * los agentes. El commit tiene el mismo SHA que el change, así que el SHA del change nombra el origen.
 */
function ReusedPill({ sha }: { sha?: string }) {
  const origin = sha ? `commit ${shortSha(sha)}` : "commit";
  return (
    <Badge
      title={`Esta review se copió de la del ${origin} (mismo código): no se volvió a pedir a los agentes.`}
    >
      Reutilizada del {origin}
    </Badge>
  );
}

/**
 * Una review como bloque: etiqueta del agente, estado y datos en la cabecera, y después el
 * resumen y los hallazgos. `showFindings` se apaga donde un panel agrupado ya los lista (el
 * detalle del change). `sha` es el del change, que nombra el commit del que se copió una review.
 */
export function ReviewCard({
  review,
  showFindings = true,
  sha,
}: {
  review: Review;
  showFindings?: boolean;
  sha?: string;
}) {
  const name = agentLabel(review.agent);
  const reason = review.status === "failed" ? sanitizeError(review.error) : null;
  return (
    <article className="review" data-status={review.status}>
      <header className="review-head">
        <AgentTag agent={review.agent} />
        <strong className="review-author">{name}</strong>
        <StatusBadge status={review.status} />
        <Meta review={review} />
        {review.reusedFrom && <ReusedPill sha={sha} />}
      </header>
      {review.status === "running" && <Loader label={`${name} está revisando…`} />}
      {review.status === "failed" && (
        <div className="review-error">
          <p>La review no pudo completarse.</p>
          {reason && <p>Motivo: {reason}</p>}
        </div>
      )}
      {review.status === "completed" && !review.partial && (
        <Completed review={review} showFindings={showFindings} />
      )}
    </article>
  );
}
