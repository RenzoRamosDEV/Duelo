import { useId, useRef, useState } from "react";
import { useParams } from "react-router";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { ChangeRow } from "../components/ChangeRow";
import { CopyButton } from "../components/CopyButton";
import { UpdatedAgo } from "../components/UpdatedAgo";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Kbd } from "../components/ui/Kbd";
import { Notice } from "../components/ui/Notice";
import { PageHeader } from "../components/ui/PageHeader";
import { Segmented } from "../components/ui/Segmented";
import { Skeleton } from "../components/ui/Skeleton";
import { useChannel } from "../hooks/useChannel";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useSlashToFocus } from "../hooks/useSlashToFocus";
import { ApiError } from "../services/apiError";
import { apiUrl, useAgentNames } from "../services/source";
import type { Change, ChangeKind } from "../types";
import { agentList } from "../utils/agents";
import type { StateFilter } from "../utils/channelQuery";
import { undoneCounts } from "../utils/commitState";
import { plural } from "../utils/format";
import { ingestCommand } from "../utils/ingestHint";
import { parseProjectPath } from "../utils/paths";

type Filter = "all" | ChangeKind;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todo" },
  { value: "pr", label: "PRs" },
  { value: "commit", label: "Commits" },
];

const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "running", label: "En curso" },
  { value: "failed", label: "Con fallos" },
  { value: "completed", label: "Completados" },
];

const SEARCH_DELAY_MS = 300;

/** Cuántos de los changes cargados hay en cada estado, para los chips de filtro. */
function stateCounts(items: readonly Change[]): Record<Exclude<StateFilter, "all">, number> {
  return {
    running: items.filter((c) => c.reviewStatus === "pending" || c.reviewStatus === "running")
      .length,
    failed: items.filter((c) => c.reviewStatus === "failed" || c.reviewStatus === "partial_failed")
      .length,
    completed: items.filter((c) => c.reviewStatus === "completed").length,
  };
}

function EmptyChannel({ slug, agents }: { slug: string; agents: string }) {
  const command = ingestCommand(slug, apiUrl);
  return (
    <EmptyState
      title="Aún no hay cambios en este canal."
      action={<CopyButton label="Copiar comando" value={command} />}
    >
      <p className="empty-text">
        Envía un commit a la API para que {agents} lo revisen. Sustituye <code>$INGEST_TOKEN</code>{" "}
        por el token de ingesta configurado en el servidor.
      </p>
      <pre className="command">
        <code>{command}</code>
      </pre>
    </EmptyState>
  );
}

export default function ChannelPage() {
  const route = parseProjectPath(useParams()["*"]);
  const slug = route.kind === "none" ? "" : route.slug;
  const [filter, setFilter] = useState<Filter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  useSlashToFocus(searchRef);
  const agentNames = useAgentNames();
  const agents = agentList(agentNames);
  const search = useDebouncedValue(query.trim(), SEARCH_DELAY_MS);
  const { first, items, hasMore, moreState, loadMore } = useChannel(slug, {
    kind: filter === "all" ? undefined : filter,
    state: stateFilter,
    q: search,
  });

  if (first.status === "error" && first.error instanceof ApiError && first.error.notFound) {
    return (
      <div className="page">
        <EmptyState
          heading="h1"
          title="Proyecto no encontrado"
          description="Este proyecto no existe o ya no se vigila."
        />
      </div>
    );
  }

  const unfiltered = filter === "all" && stateFilter === "all" && search === "";
  const emptyChannel = items.length === 0 && unfiltered && !hasMore;
  // Los chips cuentan lo cargado, que ya viene filtrado por el servidor: con un filtro activo solo
  // su propio chip puede llevar número. Un commit deshecho cuenta como un cambio normal y su
  // estado se dice aparte en la línea de resumen («1 deshecho · 2 revertidos»).
  const counts = stateCounts(items);
  const stateOptions = STATE_FILTERS.map((option) => {
    const count = option.value === "all" ? items.length : counts[option.value];
    const shown = stateFilter === "all" || stateFilter === option.value;
    return {
      ...option,
      count: shown ? count : undefined,
      alert: option.value === "failed" && shown && counts.failed > 0,
    };
  });
  const summary = [
    hasMore ? `${items.length}+ cambios cargados` : plural(items.length, "cambio", "cambios"),
    undoneCounts(items),
  ]
    .filter(Boolean)
    .join(" · ");
  const loadMoreLabel = moreState === "error" ? "Reintentar" : "Cargar más";

  return (
    <div className="page">
      <PageHeader title={`#${slug}`} subtitle={`Commits y PRs revisados por ${agents}.`}>
        <UpdatedAgo liveness={first.liveness} />
      </PageHeader>
      <div className="toolbar">
        <div className="search-box">
          <label className="visually-hidden" htmlFor={searchId}>
            Buscar cambios
          </label>
          <input
            id={searchId}
            ref={searchRef}
            className="input"
            type="search"
            placeholder="Buscar por título, autor, SHA o rama"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="search-key">
            <Kbd>/</Kbd>
          </span>
        </div>
        <Segmented label="Filtro" options={FILTERS} value={filter} onChange={setFilter} />
      </div>
      <section className="list-box" aria-label="Cambios">
        <div className="list-head">
          <Segmented
            label="Estado de la review"
            options={stateOptions}
            value={stateFilter}
            onChange={setStateFilter}
          />
          {items.length > 0 && <span className="list-count">{summary}</span>}
        </div>
        <AsyncBoundary state={first} loadingLabel="Cargando cambios…" skeleton={<Skeleton />}>
          {() => (
            <>
              {items.length === 0 && !emptyChannel && (
                <output className="list-empty">Ningún cambio coincide con la búsqueda.</output>
              )}
              {emptyChannel && <EmptyChannel slug={slug} agents={agents} />}
              {items.length > 0 && (
                <ul className="change-list">
                  {items.map((c) => (
                    <ChangeRow key={c.id} change={c} slug={slug} agentNames={agentNames} />
                  ))}
                </ul>
              )}
              {moreState === "error" && (
                <Notice tone="err" role="alert">
                  <p>No se pudieron cargar más cambios.</p>
                </Notice>
              )}
              {hasMore && (
                <div className="list-foot">
                  <Button onClick={loadMore} busy={moreState === "loading" && "Cargando…"}>
                    {loadMoreLabel}
                  </Button>
                </div>
              )}
            </>
          )}
        </AsyncBoundary>
      </section>
    </div>
  );
}
