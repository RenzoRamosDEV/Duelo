import type { Change } from "../types";
import { agentLabel } from "../utils/agents";
import { pendingAgents } from "../utils/pending";
import { Loader } from "./ui/Loader";

/**
 * Una línea por agente configurado que aún no entregó su review de la run actual. Desaparece
 * sola cuando llega (la página sigue refrescándose mientras el change está en curso).
 */
export function PendingAgents({
  change,
  agentNames,
}: {
  change: Pick<Change, "reviewStatus" | "reviews" | "run">;
  agentNames: readonly string[] | null;
}) {
  const waiting = pendingAgents(change, agentNames);
  if (waiting !== null && waiting.length === 0) return null;
  return (
    <ul className="pending-agents" aria-label="Agentes pendientes">
      {waiting === null ? (
        <li>
          <Loader label="Esperando a los agentes…" />
        </li>
      ) : (
        waiting.map((agent) => (
          <li key={agent}>
            <Loader label={`${agentLabel(agent)} está revisando…`} />
          </li>
        ))
      )}
    </ul>
  );
}
