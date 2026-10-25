import { useMemo, useState } from "react";
import type { Review } from "../types";
import { groupFindings, severityLabel, severityRank, severityTone } from "../utils/findings";
import { FindingCard } from "./FindingCard";

/** Cuántos hallazgos hay de cada severidad, la más grave primero. */
function severityCounts(reviews: Review[]): { severity: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    for (const finding of review.findings ?? []) {
      const name = finding.severity.toLowerCase();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([severity, count]) => ({ severity, count }))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
}

/**
 * Hallazgos de todas las reviews agrupados por archivo, con un contador por severidad que
 * también filtra. Sin ninguno no pinta nada: cada review ya dice «Sin hallazgos».
 */
export function FindingsPanel({ reviews }: { reviews: Review[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const counts = useMemo(() => severityCounts(reviews), [reviews]);
  const groups = useMemo(() => groupFindings(reviews), [reviews]);
  const total = counts.reduce((sum, c) => sum + c.count, 0);

  if (total === 0) return null;

  // Un filtro cuya severidad desapareció (un refresco la quitó) no debe dejar el panel vacío.
  const active = filter !== null && counts.some((c) => c.severity === filter) ? filter : null;
  const visible = groups
    .map((group) => ({
      ...group,
      findings: group.findings.filter(
        (f) => active === null || f.severity.toLowerCase() === active,
      ),
    }))
    .filter((group) => group.findings.length > 0);

  return (
    <section className="findings" aria-labelledby="findings-title">
      <div className="findings-head">
        <h3 id="findings-title">
          Hallazgos <span className="count">{total}</span>
        </h3>
        <fieldset className="sev-filters">
          <legend className="visually-hidden">Filtrar hallazgos por severidad</legend>
          <button
            type="button"
            className="sev-filter"
            aria-pressed={active === null}
            onClick={() => setFilter(null)}
          >
            Todos <span className="count">{total}</span>
          </button>
          {counts.map(({ severity, count }) => (
            <button
              key={severity}
              type="button"
              className="sev-filter"
              data-tone={severityTone(severity)}
              aria-pressed={active === severity}
              onClick={() => setFilter(active === severity ? null : severity)}
            >
              {severityLabel(severity)} <span className="count">{count}</span>
            </button>
          ))}
        </fieldset>
      </div>
      {visible.map((group) => (
        <div key={group.file ?? "no-file"} className="finding-group">
          <h4 className={group.file ? "mono" : undefined}>{group.file ?? "Sin archivo"}</h4>
          <ul className="finding-list">
            {group.findings.map((f) => (
              <li key={f.key}>
                <FindingCard id={f.key} finding={f} agent={f.agent} showFile={false} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
