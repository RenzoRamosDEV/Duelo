import type { Review } from "../data/types";
import { splitRuns } from "../lib/runs";
import { AgentAvatar, agentLabel } from "./ui/AgentAvatar";

export type CheckState = "completed" | "failed" | "waiting";

const STATE_TEXT: Record<CheckState, string> = {
  completed: "completada",
  failed: "fallida",
  waiting: "en espera",
};

/** The glyph travels with the state, so it does not depend on the color alone. */
const MARK: Record<CheckState, string | null> = { completed: "✓", failed: "✕", waiting: null };

/**
 * One state per agent for the change's CURRENT run: the agents the backend expects (when known)
 * plus any agent that already has a review, in a stable alphabetical order. A review that is still
 * running, or an expected agent with no review yet, is "waiting".
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
 * The agents' "checks" on the right of a change row: the agent's logo with a check (answered), a
 * cross (failed) or nothing and dimmed (still waiting). Each one is announced as «Claude:
 * completada».
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
      {states.map(({ agent, state }) => {
        const text = `${agentLabel(agent)}: ${STATE_TEXT[state]}`;
        return (
          <li key={agent}>
            <span className="check" data-status={state} role="img" aria-label={text} title={text}>
              <AgentAvatar agent={agent} size={20} />
              {MARK[state] && (
                <span className="check-mark" aria-hidden="true">
                  {MARK[state]}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
