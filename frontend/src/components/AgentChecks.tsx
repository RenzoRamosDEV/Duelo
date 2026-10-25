import type { Review } from "../types";
import { agentLabel } from "../utils/agents";
import { splitRuns } from "../utils/runs";
import { AgentTag } from "./AgentTag";

export type CheckState = "completed" | "failed" | "waiting";

const STATE_TEXT: Record<CheckState, string> = {
  completed: "completada",
  failed: "fallida",
  waiting: "en espera",
};

/** El glifo acompaña al estado, para que no dependa solo del color. */
const MARK: Record<CheckState, string | null> = { completed: "✓", failed: "✕", waiting: null };

/**
 * Un estado por agente para la run ACTUAL del change: los agentes que el backend espera (si se
 * conocen) más cualquiera que ya tenga review, en orden alfabético estable. Una review aún en
 * curso, o un agente esperado sin review, está «en espera».
 */
export function agentStates(
  reviews: readonly Review[],
  run: number | undefined,
  expected: readonly string[] | null,
): { agent: string; state: CheckState }[] {
  const { current } = splitRuns(reviews, run);
  const byAgent = new Map<string, CheckState>();
  for (const name of expected ?? []) byAgent.set(name, "waiting");
  for (const review of current) {
    byAgent.set(review.agent, review.status === "running" ? "waiting" : review.status);
  }
  return [...byAgent]
    .map(([agent, state]) => ({ agent, state }))
    .sort((a, b) => a.agent.localeCompare(b.agent));
}

/**
 * Los «checks» de los agentes a la derecha de una fila: la etiqueta del agente con un check
 * (respondió), un aspa (falló) o nada y atenuada (en espera). Cada uno se lee «Claude: completada».
 */
export function AgentChecks({
  reviews,
  run,
  expected,
}: {
  reviews: readonly Review[];
  run: number | undefined;
  expected: readonly string[] | null;
}) {
  const states = agentStates(reviews, run, expected);
  if (states.length === 0) return null;
  return (
    <ul className="checks" aria-label="Respuesta de cada agente">
      {states.map(({ agent, state }) => (
        <li key={agent} className="check" data-status={state}>
          <span aria-hidden="true">
            <AgentTag agent={agent} muted={state === "waiting"} />
            {MARK[state] && <span className="check-mark"> {MARK[state]}</span>}
          </span>
          <span className="visually-hidden">
            {agentLabel(agent)}: {STATE_TEXT[state]}
          </span>
        </li>
      ))}
    </ul>
  );
}
