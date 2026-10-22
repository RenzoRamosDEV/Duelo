import { memo, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { AgentChecks } from "../../components/AgentChecks";
import { AsyncBoundary } from "../../components/AsyncBoundary";
import { Busy } from "../../components/Busy";
import { CopyButton } from "../../components/CopyButton";
import { EmptyState } from "../../components/EmptyState";
import { StatusIcon } from "../../components/StatusIcon";
import { UndoneLabel, UndoneStatusIcon } from "../../components/UndoneNotice";
import { UpdatedAgo } from "../../components/UpdatedAgo";
import { HERO } from "../../components/brand";
import { Beam } from "../../components/fx/Beam";
import { CommitIcon, PullRequestIcon, SearchIcon } from "../../components/icons";
import { Button } from "../../components/ui/Button";
import { useAgentNames } from "../../data/source";
import type { Change, ChangeKind } from "../../data/types";
import { agentList } from "../../lib/agents";
import { ApiError } from "../../lib/api";
import type { StateFilter } from "../../lib/channelQuery";
import { undoneCounts, undoneNotice } from "../../lib/commitState";
import { sameValue } from "../../lib/equal";
import { ingestCommand } from "../../lib/ingestHint";
import { useNow } from "../../lib/now";
import { isWaiting } from "../../lib/pending";
import { changePath } from "../../lib/projectPath";
import { relativeTime } from "../../lib/relativeTime";
import { shortSha } from "../../lib/url";
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useChannel } from "./useChannel";

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

function Age({ iso }: { iso: string | undefined }) {
  const now = useNow();
  const text = iso ? relativeTime(iso, now) : null;
  if (!iso || !text) return null;
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString("es-ES")}>
      {text}
    </time>
  );
}

/**
 * One compact line per change. The whole row is the link to the change page (the title is its
 * only focusable element; its `::after` stretches over the row), so there is nothing to expand
 * here: the answers of each agent live on the detail page. A commit that is no longer on its
 * branch (or was reverted) is shown in amber, with its state said in words in the row.
 */
interface ChangeRowProps {
  change: Change;
  slug: string;
  agentNames: readonly string[] | null;
}

// Every refresh parses fresh objects, so the change is compared by value: a poll that changes one
// change redraws only its row.
const sameRow = (a: ChangeRowProps, b: ChangeRowProps) =>
  a.slug === b.slug && a.agentNames === b.agentNames && sameValue(a.change, b.change);

const ChangeRow = memo(function ChangeRow({ change, slug, agentNames }: ChangeRowProps) {
  const KindIcon = change.kind === "pr" ? PullRequestIcon : CommitIcon;
  const undone = undoneNotice(change);
  return (
    <li
      className="change"
      data-status={change.reviewStatus}
      data-commit-state={undone ? undone.state : undefined}
    >
      <Beam active={isWaiting(change.reviewStatus)}>
        <div className="change-row" data-undone={undone ? "" : undefined}>
          {undone ? (
            <UndoneStatusIcon notice={undone} />
          ) : (
            <StatusIcon status={change.reviewStatus} />
          )}
          <div className="change-main">
            <Link className="change-link" to={changePath(slug, change.id)}>
              <strong>{change.title}</strong>
            </Link>
            <span className="kind-label" data-kind={change.kind}>
              <KindIcon size={12} />
              {change.kind === "pr" ? "PR" : "Commit"}
            </span>
            {undone && <UndoneLabel notice={undone} />}
          </div>
          <span className="change-meta muted">
            #<span className="mono">{shortSha(change.sha)}</span> · por {change.author}
            {change.createdAt && (
              <>
                {" · "}
                <Age iso={change.createdAt} />
              </>
            )}
          </span>
          <AgentChecks reviews={change.reviews ?? []} run={change.run} expected={agentNames} />
        </div>
      </Beam>
    </li>
  );
}, sameRow);

function EmptyChannel({ slug, agents }: { slug: string; agents: string }) {
  const command = ingestCommand(slug, import.meta.env.VITE_API_URL);
  return (
    <EmptyState
      hero={HERO}
      title="Aún no hay cambios en este canal."
      className="empty"
      action={<CopyButton label="Copiar comando" value={command} />}
    >
      <p className="muted">
        Envía un commit a la API para que {agents} lo revisen. Sustituye <code>$INGEST_TOKEN</code>{" "}
        por el token de ingesta configurado en el servidor.
      </p>
      <pre className="command">
        <code>{command}</code>
      </pre>
    </EmptyState>
  );
}

/** Placeholder rows while the first page loads; purely visual. */
function ChangeSkeletons() {
  return (
    <ul className="change-list skeleton" aria-hidden="true">
      {[0, 1, 2, 3].map((n) => (
        <li key={n} className="change">
          <div className="change-row">
            <span className="sk sk-circle" />
            <div className="change-main">
              <span className="sk sk-line" style={{ width: `${62 - n * 8}%` }} />
              <span className="sk sk-line sk-short" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** "3 en curso · 1 con fallos · 12 completados" for the changes loaded so far. */
function stateCounts(items: readonly Change[]): string {
  const running = items.filter(
    (c) => c.reviewStatus === "pending" || c.reviewStatus === "running",
  ).length;
  const failed = items.filter(
    (c) => c.reviewStatus === "failed" || c.reviewStatus === "partial_failed",
  ).length;
  const done = items.filter((c) => c.reviewStatus === "completed").length;
  return [
    running > 0 && `${running} en curso`,
    failed > 0 && `${failed} con fallos`,
    done > 0 && `${done} completados`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Focuses the search box on "/", unless the user is already typing somewhere. */
function useSlashToSearch(input: React.RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [input]);
}

export function ChannelPage({ slug }: { slug: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [stateFilter, setStateFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const searchId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  useSlashToSearch(searchRef);
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
        <EmptyState kind="missing" hero={HERO} heading title="Proyecto no encontrado">
          <p className="muted">Este proyecto no existe o ya no se vigila.</p>
        </EmptyState>
      </div>
    );
  }

  const unfiltered = filter === "all" && stateFilter === "all" && search === "";
  const emptyChannel = items.length === 0 && unfiltered && !hasMore;
  // The review counters keep counting an undone commit as a normal change; its own state is said
  // apart ("1 deshecho · 2 revertidos").
  const counts = [stateCounts(items), undoneCounts(items)].filter(Boolean).join(" · ");
  return (
    <div className="page">
      <div className="channel-head">
        <h1>#{slug}</h1>
        <p className="channel-desc">Commits y PRs revisados por {agents}.</p>
        <UpdatedAgo liveness={first.liveness} />
      </div>
      <div className="toolbar">
        <div className="search-box">
          <SearchIcon />
          <label className="visually-hidden" htmlFor={searchId}>
            Buscar cambios
          </label>
          <input
            id={searchId}
            ref={searchRef}
            className="search"
            type="search"
            placeholder="Buscar por título, autor, SHA o rama"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd" aria-hidden="true">
            /
          </span>
        </div>
        <fieldset className="segmented" aria-label="Filtro">
          {FILTERS.map((f) => (
            <button
              type="button"
              className="segment"
              key={f.value}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
      </div>
      <div className="list-box">
        <div className="list-head">
          <fieldset className="state-tabs" aria-label="Estado de la review">
            {STATE_FILTERS.map((f) => (
              <button
                type="button"
                className="state-tab"
                key={f.value}
                aria-pressed={stateFilter === f.value}
                onClick={() => setStateFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </fieldset>
          {items.length > 0 && (
            <span className="list-count muted">
              {items.length}
              {hasMore ? "+" : ""} {items.length === 1 && !hasMore ? "cambio" : "cambios"}
              {counts && ` · ${counts}`}
            </span>
          )}
        </div>
        <AsyncBoundary
          state={first}
          loadingLabel="Cargando cambios…"
          skeleton={<ChangeSkeletons />}
        >
          {() => (
            <>
              {items.length === 0 && !emptyChannel && (
                <output className="list-empty muted">
                  Ningún cambio coincide con la búsqueda.
                </output>
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
                <p className="notice" role="alert">
                  No se pudieron cargar más cambios.
                </p>
              )}
              {hasMore && (
                <div className="list-foot">
                  <Button onClick={loadMore} disabled={moreState === "loading"}>
                    {moreState === "loading" ? (
                      <Busy activity="more" label="Cargando…" inline />
                    ) : moreState === "error" ? (
                      "Reintentar"
                    ) : (
                      "Cargar más"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </AsyncBoundary>
      </div>
    </div>
  );
}
