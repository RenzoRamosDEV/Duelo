import type { Change } from "../types";
import { isWaiting } from "./reviewStatus";
import { splitRuns } from "./runs";

/**
 * Agentes a los que un change sigue esperando. Con la API real una review sin terminar no se
 * guarda, así que «revisando» se infiere: un change `pending`/`running` espera a cada agente
 * configurado sin review de su run ACTUAL. `null` cuando aún no se conocen los agentes pero se
 * esperan reviews, para no inventar nombres.
 */
export function pendingAgents(
  change: Pick<Change, "reviewStatus" | "reviews" | "run">,
  agentNames: readonly string[] | null,
): readonly string[] | null {
  if (!isWaiting(change.reviewStatus)) return [];
  if (agentNames === null || agentNames.length === 0) return null;
  const { current } = splitRuns(change.reviews ?? [], change.run);
  const delivered = new Set(current.map((review) => review.agent));
  return agentNames.filter((agent) => !delivered.has(agent));
}
