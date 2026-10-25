const LABEL: Record<string, string> = { claude: "Claude", codex: "Codex" };

/** Nombre para frases («Claude está revisando…»); los desconocidos van capitalizados. */
export function agentLabel(agent: string): string {
  return LABEL[agent.toLowerCase()] ?? (agent.charAt(0).toUpperCase() + agent.slice(1) || "?");
}

/** Etiqueta monospace del agente: `claude`, `codex` o el nombre tal cual. */
export function agentTag(agent: string): string {
  return LABEL[agent.toLowerCase()] ? agent.toLowerCase() : agent;
}

/** Mientras no se conocen los agentes (cargando o un servidor que no los informa). */
const UNKNOWN_AGENTS = "los agentes configurados";

/** `Claude`, `Claude y Codex`, `A, B y C`: los agentes como enumeración en español. */
export function agentList(names: readonly string[] | null | undefined): string {
  if (!names || names.length === 0) return UNKNOWN_AGENTS;
  const labels = names.map(agentLabel);
  if (labels.length === 1) return labels[0] as string;
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
