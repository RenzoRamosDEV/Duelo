import { useCallback, useId } from "react";
import { AgentTag } from "../components/AgentTag";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { ProjectsSettings } from "../components/ProjectsSettings";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAsync } from "../hooks/useAsync";
import { useEffectsPreference } from "../hooks/useEffectsPreference";
import { useDataSource } from "../services/source";
import type { DependencyHealth, Health } from "../types";
import { agentLabel } from "../utils/agents";

const DEPENDENCY_LABEL: Record<string, string> = { postgres: "Postgres", temporal: "Temporal" };
const REASON_LABEL: Record<NonNullable<DependencyHealth["reason"]>, string> = {
  timeout: "Tiempo agotado",
  error: "Error",
};

const dependencyLabel = (name: string) => DEPENDENCY_LABEL[name] ?? name;

/** Los agentes configurados como etiquetas; un servidor que no los informa muestra un guion. */
function AgentChips({ names }: { names: readonly string[] }) {
  if (names.length === 0) return <span className="text-muted">—</span>;
  return (
    <ul className="row" aria-label="Agentes activos">
      {names.map((name) => (
        <li key={name} className="row">
          <AgentTag agent={name} /> {agentLabel(name)}
        </li>
      ))}
    </ul>
  );
}

function Diagnostics({ health }: { health: Health }) {
  return (
    <>
      <div className="setting">
        <span>Estado del servidor</span>
        <Badge tone={health.status === "ok" ? "ok" : "warn"}>
          {health.status === "ok" ? "Correcto" : "Degradado"}
        </Badge>
      </div>
      {health.dependencies.map((d) => (
        <div className="setting" key={d.name}>
          <span>{dependencyLabel(d.name)}</span>
          <span className="row">
            <Badge tone={d.status === "ok" ? "ok" : "err"}>
              {d.status === "ok" ? "Disponible" : "No disponible"}
            </Badge>
            <span className="meta mono">{d.latencyMs} ms</span>
            {d.reason && <span className="text-muted">{REASON_LABEL[d.reason]}</span>}
          </span>
        </div>
      ))}
    </>
  );
}

function EffectsSetting() {
  const [enabled, setEnabled] = useEffectsPreference();
  const id = useId();
  const hintId = useId();
  return (
    <div className="setting">
      <span>
        <label htmlFor={id}>Efectos de pantalla</label>
        <span className="field-hint" id={hintId}>
          Scanlines y cursor parpadeante. Se apagan también si tu sistema pide reducir el
          movimiento.
        </span>
      </span>
      <label className="checkbox">
        <input
          id={id}
          type="checkbox"
          checked={enabled}
          aria-describedby={hintId}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        {enabled ? "Activados" : "Desactivados"}
      </label>
    </div>
  );
}

export default function SettingsPage() {
  const source = useDataSource();
  const health = useAsync(
    useCallback((signal: AbortSignal) => source.health({ signal }), [source]),
  );
  const agentNames = health.status === "ready" ? health.data.agentNames : null;
  return (
    <div className="page">
      <PageHeader title="Ajustes" subtitle="Pantalla, estado del servidor y proyectos vigilados." />
      <Card title="Pantalla">
        <EffectsSetting />
      </Card>
      <Card title="General">
        <div className="setting">
          <span>Voto ciego</span>
          <Badge>Próximamente</Badge>
        </div>
        <div className="setting">
          <span>Agentes activos</span>
          {agentNames ? <AgentChips names={agentNames} /> : <span className="text-muted">—</span>}
        </div>
      </Card>
      <ProjectsSettings available={agentNames} />
      <Card
        title="Diagnóstico"
        actions={
          <Button size="sm" onClick={health.retry}>
            Actualizar
          </Button>
        }
      >
        <AsyncBoundary state={health} loadingLabel="Comprobando dependencias…">
          {(data) => <Diagnostics health={data} />}
        </AsyncBoundary>
      </Card>
    </div>
  );
}
