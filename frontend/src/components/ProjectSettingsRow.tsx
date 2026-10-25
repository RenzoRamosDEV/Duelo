import type { ProjectRef } from "../types";
import { AgentPicker } from "./AgentPicker";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

export interface ProjectMessage {
  tone: "ok" | "error";
  text: string;
}

/** Un proyecto vigilado en Ajustes: nombre, ruta, hooks, sincronizar PRs, agentes y baja. */
export function ProjectSettingsRow({
  project,
  available,
  message,
  syncing,
  savingAgents,
  onSync,
  onSaveAgents,
  onRemove,
}: {
  project: ProjectRef;
  available: readonly string[] | null;
  message: ProjectMessage | undefined;
  syncing: boolean;
  savingAgents: boolean;
  onSync: () => void;
  onSaveAgents: (agents: string[]) => void;
  onRemove: () => void;
}) {
  return (
    <li className="project-settings">
      <div className="project-settings-head">
        <div>
          <strong className="mono">{project.name}</strong>
          {project.path && <div className="project-path">{project.path}</div>}
        </div>
        <div className="row">
          {project.hooksInstalled !== undefined && (
            <Badge tone={project.hooksInstalled ? "ok" : "warn"}>
              {project.hooksInstalled ? "Hooks instalados" : "Sin hooks"}
            </Badge>
          )}
          {project.github && (
            <Button
              size="sm"
              onClick={onSync}
              busy={syncing && "Sincronizando…"}
              // Mientras corre, el texto visible es el nombre («Sincronizando…»).
              aria-label={syncing ? undefined : `Sincronizar PRs de ${project.name}`}
            >
              Sincronizar PRs
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            onClick={onRemove}
            aria-label={`Quitar proyecto ${project.name}`}
          >
            Quitar proyecto
          </Button>
        </div>
      </div>
      {available && available.length > 1 && (
        <AgentPicker
          key={`${project.slug}:${(project.agents ?? available).join()}`}
          project={project}
          available={available}
          saving={savingAgents}
          onSave={onSaveAgents}
        />
      )}
      {message && (
        <Notice
          tone={message.tone === "error" ? "err" : "ok"}
          role={message.tone === "error" ? "alert" : "status"}
        >
          <p>{message.text}</p>
        </Notice>
      )}
    </li>
  );
}
