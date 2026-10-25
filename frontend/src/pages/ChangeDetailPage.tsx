import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { CopyButton } from "../components/CopyButton";
import { DiffView } from "../components/DiffView";
import { FindingsPanel } from "../components/FindingsPanel";
import { PendingAgents } from "../components/PendingAgents";
import { RetryReview } from "../components/RetryReview";
import { ReviewCard } from "../components/ReviewCard";
import { StatusBadge } from "../components/StatusBadge";
import { UndoneBanner } from "../components/UndoneNotice";
import { UpdatedAgo } from "../components/UpdatedAgo";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Notice } from "../components/ui/Notice";
import { useAsync } from "../hooks/useAsync";
import { useAgentNames, useDataSource } from "../services/source";
import type { Change, Review } from "../types";
import { sameValue } from "../utils/equal";
import { plural } from "../utils/format";
import type { Liveness } from "../utils/liveness";
import { parseProjectPath, projectPath } from "../utils/paths";
import { POLL_MS } from "../utils/polling";
import { isRetryable, isWaiting } from "../utils/reviewStatus";
import { splitRuns } from "../utils/runs";
import { safeHttpUrl, shortSha } from "../utils/url";

/** Un change cuyas reviews aún se producen sigue refrescándose; uno terminado no. */
const inProgress = (change: Change) => isWaiting(change.reviewStatus);

/** Reviews en orden estable (por agente), las envíe la API como las envíe. */
const byAgent = (reviews: Review[]) => [...reviews].sort((a, b) => a.agent.localeCompare(b.agent));

export default function ChangeDetailPage() {
  const route = parseProjectPath(useParams()["*"]);
  const slug = route.kind === "none" ? "" : route.slug;
  const id = route.kind === "change" ? route.id : "";
  const source = useDataSource();
  const agentNames = useAgentNames();
  const state = useAsync(
    useCallback((signal: AbortSignal) => source.change(id, { signal }), [source, id]),
    { pollMs: POLL_MS, pollWhile: inProgress, equals: sameValue },
  );
  const [note, setNote] = useState<string | null>(null);
  const { refresh } = state;
  const onRetried = (message: string) => {
    setNote(message);
    refresh();
  };

  return (
    <AsyncBoundary
      state={state}
      loadingLabel="Cargando change…"
      notFound={
        <div className="page">
          <EmptyState
            heading="h1"
            title="Change no encontrado"
            description="Este change no existe o se eliminó junto con su proyecto."
          />
        </div>
      }
    >
      {(change) => (
        <ChangeDetail
          change={change}
          slug={slug}
          agentNames={agentNames}
          liveness={state.liveness}
          note={note}
          onRetried={onRetried}
        />
      )}
    </AsyncBoundary>
  );
}

function ChangeDetail({
  change,
  slug,
  agentNames,
  liveness,
  note,
  onRetried,
}: {
  change: Change;
  slug: string;
  agentNames: readonly string[] | null;
  liveness: Liveness;
  note: string | null;
  onRetried: (message: string) => void;
}) {
  const url = safeHttpUrl(change.url);
  // Solo cuenta la run actual; un reintento conserva las reviews anteriores, plegadas.
  const { current: reviews, previous } = useMemo(
    () => splitRuns(change.reviews ?? [], change.run),
    [change.reviews, change.run],
  );
  return (
    <div className="page">
      <header className="page-head detail-head">
        <nav className="crumbs" aria-label="Migas">
          <Link to="/">Proyectos</Link> / <Link to={projectPath(slug)}>#{slug}</Link> /{" "}
          <span className="mono" aria-current="page">
            {shortSha(change.sha)}
          </span>
        </nav>
        <h1 className="prompt">{change.title}</h1>
        <UndoneBanner change={change} slug={slug} />
        {change.reviewStatus && (
          <p className="row status-line">
            <StatusBadge status={change.reviewStatus} />
            {change.run !== undefined && <span className="text-secondary">Run {change.run}</span>}
            <span className="text-secondary">
              por {change.author}
              {change.ref && (
                <>
                  {" en "}
                  <span className="mono">{change.ref}</span>
                </>
              )}
            </span>
          </p>
        )}
        <PendingAgents change={change} agentNames={agentNames} />
        {inProgress(change) && <UpdatedAgo liveness={liveness} />}
        <div className="row">
          {url && (
            <a className="button" href={url} target="_blank" rel="noopener noreferrer">
              Abrir en GitHub ↗
            </a>
          )}
          <CopyButton label="Copiar SHA" value={change.sha} />
          {change.ref && <CopyButton label="Copiar rama" value={change.ref} />}
        </div>
      </header>
      {note && (
        <Notice tone="ok">
          <p>{note}</p>
        </Notice>
      )}
      {isRetryable(change.reviewStatus) && (
        <RetryReview changeId={change.id} onSettled={onRetried} />
      )}
      <Card
        title="Revisión de los agentes"
        className={inProgress(change) ? "card-live" : undefined}
      >
        <div className="stack">
          {reviews.length === 0 && !inProgress(change) && (
            <p className="text-secondary">Aún no hay respuestas de los agentes.</p>
          )}
          {reviews.length > 0 && (
            <div className="reviews">
              {byAgent(reviews).map((r) => (
                <ReviewCard key={r.id} review={r} showFindings={false} sha={change.sha} />
              ))}
            </div>
          )}
          <FindingsPanel reviews={reviews} />
          {previous.map((p) => (
            <details key={p.run} className="previous-run">
              <summary>
                Run {p.run} (anterior) · {plural(p.reviews.length, "review", "reviews")}
              </summary>
              <div className="reviews">
                {byAgent(p.reviews).map((r) => (
                  <ReviewCard key={r.id} review={r} sha={change.sha} />
                ))}
              </div>
            </details>
          ))}
        </div>
      </Card>
      <DiffView diff={change.diff} truncated={change.truncated} />
    </div>
  );
}
