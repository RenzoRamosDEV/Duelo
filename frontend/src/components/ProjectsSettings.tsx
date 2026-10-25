import { useId, useState } from "react";
import { clearIngestToken, useIngestToken } from "../hooks/useIngestToken";
import { useProjects } from "../hooks/useProjects";
import { ApiError } from "../services/apiError";
import { apiErrorMessage } from "../services/errorMessage";
import { useDataSource } from "../services/source";
import type { ProjectRef, SyncResult } from "../types";
import { agentLabel } from "../utils/agents";
import { AsyncBoundary } from "./AsyncBoundary";
import { type ProjectMessage, ProjectSettingsRow } from "./ProjectSettingsRow";
import { RemoveProjectDialog } from "./RemoveProjectDialog";
import { TokenField } from "./TokenField";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Toast } from "./ui/Toast";

const MISSING_TOKEN = "Introduce el token de ingesta.";
const PROJECT_FAILURES = { 404: "El proyecto ya no existe." } as const;

function syncText({ synced, created }: SyncResult): string {
  const prs = `${synced} ${synced === 1 ? "PR sincronizada" : "PRs sincronizadas"}`;
  return `${prs} (${created} ${created === 1 ? "nueva" : "nuevas"}).`;
}

/** Caja de Ajustes: la lista viva de proyectos con su ruta y hooks, sincronización, agentes y baja. */
export function ProjectsSettings({ available }: { available: readonly string[] | null }) {
  const source = useDataSource();
  const { projects, openAddProject } = useProjects();
  const [token] = useIngestToken();
  const [messages, setMessages] = useState<Record<string, ProjectMessage>>({});
  const [syncing, setSyncing] = useState<string | null>(null);
  const [savingAgents, setSavingAgents] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ProjectRef | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const tokenId = useId();

  const say = (slug: string, message: ProjectMessage) =>
    setMessages((current) => ({ ...current, [slug]: message }));

  async function sync(project: ProjectRef) {
    if (syncing) return;
    if (!token.trim()) {
      say(project.slug, { tone: "error", text: MISSING_TOKEN });
      return;
    }
    setSyncing(project.slug);
    try {
      say(project.slug, {
        tone: "ok",
        text: syncText(await source.syncPrs(project.slug, token.trim())),
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearIngestToken();
      say(project.slug, {
        tone: "error",
        text: apiErrorMessage(e, PROJECT_FAILURES, "sincronizar las PRs"),
      });
    } finally {
      setSyncing(null);
    }
  }

  async function saveAgents(project: ProjectRef, agents: string[]) {
    if (savingAgents) return;
    if (!token.trim()) {
      say(project.slug, { tone: "error", text: MISSING_TOKEN });
      return;
    }
    setSavingAgents(project.slug);
    try {
      await source.setAgents(project.slug, agents, token.trim());
      say(project.slug, {
        tone: "ok",
        text: `Agentes guardados: ${agents.map(agentLabel).join(" y ")}. Aplica a los próximos commits.`,
      });
      projects.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearIngestToken();
      say(project.slug, {
        tone: "error",
        text:
          e instanceof ApiError && e.status === 422
            ? `Selección no válida: ${e.message}`
            : apiErrorMessage(e, PROJECT_FAILURES, "guardar los agentes"),
      });
    } finally {
      setSavingAgents(null);
    }
  }

  return (
    <Card
      title="Proyectos vigilados"
      actions={
        <Button size="sm" variant="primary" onClick={openAddProject}>
          Añadir proyecto
        </Button>
      }
    >
      <div className="stack">
        <AsyncBoundary state={projects} loadingLabel="Cargando proyectos…">
          {(list) =>
            list.length === 0 ? (
              <p className="text-muted">Aún no hay proyectos vigilados.</p>
            ) : (
              <>
                <div className="settings-token">
                  <TokenField id={tokenId} />
                </div>
                <ul className="stack">
                  {list.map((p) => (
                    <ProjectSettingsRow
                      key={p.slug}
                      project={p}
                      available={available}
                      message={messages[p.slug]}
                      syncing={syncing === p.slug}
                      savingAgents={savingAgents === p.slug}
                      onSync={() => sync(p)}
                      onSaveAgents={(agents) => saveAgents(p, agents)}
                      onRemove={() => setRemoving(p)}
                    />
                  ))}
                </ul>
              </>
            )
          }
        </AsyncBoundary>
      </div>
      {notice && <Toast message={notice} onClose={() => setNotice(null)} />}
      {removing && (
        <RemoveProjectDialog
          project={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            setNotice(`Proyecto ${removing.name} quitado.`);
            setRemoving(null);
            projects.refresh();
          }}
        />
      )}
    </Card>
  );
}
