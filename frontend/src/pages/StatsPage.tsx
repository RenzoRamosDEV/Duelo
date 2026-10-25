import { useCallback, useState } from "react";
import { AgentTag } from "../components/AgentTag";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { EmptyState } from "../components/ui/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import { Table } from "../components/ui/Table";
import { useAsync } from "../hooks/useAsync";
import { useDataSource } from "../services/source";
import type { AgentStat } from "../types";
import { agentLabel } from "../utils/agents";
import { formatDuration, formatScore } from "../utils/format";
import { ratio } from "../utils/meter";
import { type SortState, nextSort, sortRows } from "../utils/sort";

type SortKey = keyof AgentStat;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "agent", label: "Agente", numeric: false },
  { key: "total", label: "Total", numeric: true },
  { key: "completed", label: "Completadas", numeric: true },
  { key: "failed", label: "Fallos", numeric: true },
  { key: "avgDurationMs", label: "Duración media", numeric: true },
  { key: "avgScore", label: "Nota media", numeric: true },
];

const LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<SortKey, string>;

function Meter({ percent, alert = false }: { percent: number; alert?: boolean }) {
  return (
    <span className="meter" aria-hidden="true" data-alert={alert ? "" : undefined}>
      <span className="meter-fill" style={{ width: `${percent}%` }} />
    </span>
  );
}

function StatsTable({ stats }: { stats: AgentStat[] }) {
  const maxDuration = Math.max(0, ...stats.map((s) => s.avgDurationMs ?? 0));
  const maxFailures = Math.max(0, ...stats.map((s) => s.failed));
  const [sort, setSort] = useState<SortState<SortKey> | null>(null);
  const rows = sort ? sortRows(stats, sort.key, sort.direction) : stats;
  return (
    <Table label="Estadísticas por agente" variant="cards">
      <thead>
        <tr>
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={c.numeric ? "num" : undefined}
              aria-sort={sort?.key === c.key ? sort.direction : undefined}
            >
              <button
                type="button"
                className="table-sort"
                onClick={() => setSort((current) => nextSort(current, c.key))}
              >
                {c.label}
                {sort?.key === c.key && (
                  <span aria-hidden="true">{sort.direction === "ascending" ? "↑" : "↓"}</span>
                )}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.agent}>
            <th scope="row" data-label={LABEL.agent}>
              <span className="row">
                <AgentTag agent={s.agent} /> {agentLabel(s.agent)}
              </span>
            </th>
            <td className="num" data-label={LABEL.total}>
              {s.total}
            </td>
            <td className="num" data-label={LABEL.completed}>
              {s.completed}
            </td>
            <td className="num" data-label={LABEL.failed}>
              {s.failed}
              <Meter percent={ratio(s.failed, maxFailures)} alert />
            </td>
            <td className="num" data-label={LABEL.avgDurationMs}>
              {formatDuration(s.avgDurationMs)}
              {s.avgDurationMs !== null && <Meter percent={ratio(s.avgDurationMs, maxDuration)} />}
            </td>
            <td className="num" data-label={LABEL.avgScore}>
              {formatScore(s.avgScore)}
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** Media de una media por agente, ponderada por cuántas reviews tiene cada uno; null si ninguna. */
function weightedMean(stats: AgentStat[], pick: (s: AgentStat) => number | null): number | null {
  let sum = 0;
  let weight = 0;
  for (const s of stats) {
    const value = pick(s);
    if (value === null) continue;
    sum += value * s.total;
    weight += s.total;
  }
  return weight > 0 ? sum / weight : null;
}

/** Tarjetas sobre la tabla: los totales de todos los agentes. */
function SummaryCards({ stats }: { stats: AgentStat[] }) {
  const total = stats.reduce((n, s) => n + s.total, 0);
  const completed = stats.reduce((n, s) => n + s.completed, 0);
  const failed = stats.reduce((n, s) => n + s.failed, 0);
  const items = [
    { label: "Reviews totales", value: String(total), alert: false },
    { label: "Completadas", value: String(completed), alert: false },
    { label: "Con fallo", value: String(failed), alert: failed > 0 },
    {
      label: "Duración media",
      value: formatDuration(weightedMean(stats, (s) => s.avgDurationMs)),
      alert: false,
    },
    {
      label: "Nota media",
      value: formatScore(weightedMean(stats, (s) => s.avgScore)),
      alert: false,
    },
  ];
  return (
    <dl className="stat-cards" aria-label="Resumen global">
      {items.map((item) => (
        <div key={item.label} className="stat-card" data-alert={item.alert ? "" : undefined}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function StatsPage() {
  const source = useDataSource();
  const state = useAsync(
    useCallback((signal: AbortSignal) => source.agentStats({ signal }), [source]),
  );
  return (
    <div className="page">
      <PageHeader
        title="Estadísticas"
        subtitle="Reviews por agente: volumen, fallos y medias de duración y nota."
      />
      <AsyncBoundary state={state} loadingLabel="Cargando estadísticas…">
        {(stats) =>
          stats.length === 0 ? (
            <EmptyState
              title="Aún no hay reviews registradas."
              description="Cuando los agentes entreguen su primera review aparecerá aquí."
            />
          ) : (
            <>
              <SummaryCards stats={stats} />
              <StatsTable stats={stats} />
            </>
          )
        }
      </AsyncBoundary>
    </div>
  );
}
