import { useCallback, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { ChangeSummary } from "../components/ChangeSummary";
import { CopyButton } from "../components/CopyButton";
import { DiffView, useParsedDiff } from "../components/DiffView";
import { FindingsPanel } from "../components/FindingsPanel";
import { PendingAgents } from "../components/PendingAgents";
import { ReviewCard } from "../components/ReviewCard";
import { StatusBadge } from "../components/StatusBadge";
import { UndoneBanner } from "../components/UndoneNotice";
import { UpdatedAgo } from "../components/UpdatedAgo";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { TabPanel, Tabs } from "../components/ui/Tabs";
import { Toast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { useAgentNames, useDataSource } from "../services/source";
import type { Change, Review } from "../types";
import { sameValue } from "../utils/equal";
import { plural } from "../utils/format";
import type { Liveness } from "../utils/liveness";
import { parseProjectPath, projectPath } from "../utils/paths";
import { pendingAgents } from "../utils/pending";
import { POLL_MS } from "../utils/polling";
import { isRetryable, isWaiting } from "../utils/reviewStatus";
import { splitRuns } from "../utils/runs";
import { safeHttpUrl, shortSha } from "../utils/url";

type Tab = "reviews" | "findings" | "diff";

/** Un change cuyas reviews aún se producen sigue refrescándose; uno terminado no. */
const inProgress = (change: Change) => isWaiting(change.reviewStatus);

/** Reviews en orden estable (por agente), las envíe la API como las envíe. */
const byAgent = (reviews: Review[]) => [...reviews].sort((a, b) => a.agent.localeCompare(b.agent));

const countFindings = (reviews: Review[]) =>
  reviews.reduce((n, review) => n + (review.findings?.length ?? 0), 0);

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
  const closeNote = useCallback(() => setNote(null), []);

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
          onNoteClose={closeNote}
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
  onNoteClose,
  onRetried,
}: {
  change: Change;
  slug: string;
  agentNames: readonly string[] | null;
  liveness: Liveness;
  note: string | null;
  onNoteClose: () => void;
  onRetried: (message: string) => void;
}) {
  const url = safeHttpUrl(change.url);
  const [tab, setTab] = useState<Tab>("reviews");
  // Solo cuenta la run actual; un reintento conserva las reviews anteriores, plegadas.
  const { current: reviews, previous } = useMemo(
    () => splitRuns(change.reviews ?? [], change.run),
    [change.reviews, change.run],
  );
  const current = byAgent(reviews);
  const pending = pendingAgents(change, agentNames);
  const { files } = useParsedDiff(change.diff);
  const findingsCount = countFindings(reviews);
  const tabs = [
    { value: "reviews" as const, label: "Reviews", count: current.length },
    { value: "findings" as const, label: "Hallazgos", count: findingsCount },
    { value: "diff" as const, label: "Diff", count: files.length },
  ];
  return (
    <div className="page">
      <PageHeader
        crumbs={
          <>
            <Link to="/">Proyectos</Link> / <Link to={projectPath(slug)}>#{slug}</Link> /{" "}
            <span className="mono" aria-current="page">
              {shortSha(change.sha)}
            </span>
          </>
        }
        title={change.title}
        meta={
          <p className="row status-line">
            {change.reviewStatus && <StatusBadge status={change.reviewStatus} />}
            <Badge>{change.kind === "pr" ? "PR" : "Commit"}</Badge>
            <span className="meta">
              <span className="mono">{shortSha(change.sha)}</span>
              {change.ref && (
                <>
                  <span className="sep" />
                  <span className="mono">{change.ref}</span>
                </>
              )}
              <span className="sep" />
              {change.author}
              {change.run !== undefined && (
                <>
                  <span className="sep" />
                  Run {change.run}
                </>
              )}
            </span>
          </p>
        }
        actions={
          <>
            {url && (
              <a
                className="button button-secondary"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en GitHub
                <Icon name="external" size={14} />
              </a>
            )}
            <CopyButton label="Copiar SHA" value={change.sha} />
            {change.ref && <CopyButton label="Copiar rama" value={change.ref} />}
          </>
        }
      >
        <UndoneBanner change={change} slug={slug} />
        <PendingAgents change={change} agentNames={agentNames} />
        {inProgress(change) && <UpdatedAgo liveness={liveness} />}
      </PageHeader>
      {note && <Toast message={note} onClose={onNoteClose} />}
      <div className="detail-grid">
        <section className="detail-main" aria-label="Revisión del change">
          <Tabs
            label="Secciones del change"
            tabs={tabs}
            value={tab}
            onChange={setTab}
            idPrefix="change"
          />
          {tab === "reviews" && (
            <TabPanel idPrefix="change" value="reviews">
              <div className="stack">
                {current.length === 0 && !inProgress(change) && (
                  <p className="text-muted">Aún no hay respuestas de los agentes.</p>
                )}
                {current.length > 0 && (
                  <div className="reviews">
                    {current.map((r) => (
                      <ReviewCard key={r.id} review={r} showFindings={false} sha={change.sha} />
                    ))}
                  </div>
                )}
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
            </TabPanel>
          )}
          {tab === "findings" && (
            <TabPanel idPrefix="change" value="findings">
              {findingsCount === 0 ? (
                <p className="text-muted">Sin hallazgos en la run actual.</p>
              ) : (
                <FindingsPanel reviews={reviews} />
              )}
            </TabPanel>
          )}
          {tab === "diff" && (
            <TabPanel idPrefix="change" value="diff">
              <DiffView diff={change.diff} truncated={change.truncated} />
            </TabPanel>
          )}
        </section>
        <aside className="detail-side">
          <ChangeSummary
            change={change}
            reviews={current}
            pending={pending}
            retryable={isRetryable(change.reviewStatus)}
            onRetried={onRetried}
          />
        </aside>
      </div>
    </div>
  );
}
