import { useState } from "react";
import type { ProjectRef } from "../types";
import { agentLabel } from "../utils/agents";
import { Button } from "./ui/Button";

/**
 * Qué agentes revisan el proyecto. Se monta con la selección del servidor (el padre lo vuelve a
 * crear cuando cambia), así que las casillas son un borrador hasta «Guardar»; al menos una debe
 * quedar marcada.
 */
export function AgentPicker({
  project,
  available,
  saving,
  onSave,
}: {
  project: ProjectRef;
  available: readonly string[];
  saving: boolean;
  onSave: (agents: string[]) => void;
}) {
  const saved = project.agents ?? available;
  const [picked, setPicked] = useState<readonly string[]>(saved);
  const chosen = available.filter((name) => picked.includes(name));
  const changed = chosen.join() !== available.filter((n) => saved.includes(n)).join();
  const toggle = (name: string) =>
    setPicked((current) =>
      current.includes(name) ? current.filter((n) => n !== name) : [...current, name],
    );
  return (
    <fieldset className="agent-picker">
      <legend>Agentes que revisan</legend>
      <div className="row">
        {available.map((name) => (
          <label key={name} className="checkbox">
            <input
              type="checkbox"
              checked={picked.includes(name)}
              onChange={() => toggle(name)}
              disabled={saving}
            />
            {agentLabel(name)}
          </label>
        ))}
        <Button
          variant="primary"
          size="sm"
          onClick={() => onSave(chosen)}
          disabled={saving || !changed || chosen.length === 0}
          aria-label={`Guardar agentes de ${project.name}`}
        >
          Guardar
        </Button>
      </div>
      <span className="field-hint">
        {chosen.length === 0 ? "Elige al menos uno." : "Aplica a los próximos commits."}
      </span>
    </fieldset>
  );
}
