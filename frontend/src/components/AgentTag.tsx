import { agentLabel, agentTag } from "../utils/agents";

/** Etiqueta monospace que identifica a un agente, `[claude]`; el nombre legible va en `title`. */
export function AgentTag({ agent, muted = false }: { agent: string; muted?: boolean }) {
  return (
    <span className={muted ? "agent-tag agent-tag-muted" : "agent-tag"} title={agentLabel(agent)}>
      [{agentTag(agent)}]
    </span>
  );
}
