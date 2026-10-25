import { useState } from "react";
import { Link } from "react-router";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { RemoveProjectDialog } from "../components/RemoveProjectDialog";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Icon } from "../components/ui/Icon";
import { PageHeader } from "../components/ui/PageHeader";
import { Toast } from "../components/ui/Toast";
import { useProjects } from "../hooks/useProjects";
import type { ProjectRef } from "../types";
import { projectPath } from "../utils/paths";

/** La portada: elegir el proyecto que se quiere ver. Nunca salta a uno por su cuenta. */
export default function ProjectsPage() {
  const { projects, openAddProject } = useProjects();
  const [removing, setRemoving] = useState<ProjectRef | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="page">
      <PageHeader
        title="Proyectos"
        subtitle="Elige el repositorio cuyos commits y PRs quieres ver."
        actions={
          <Button variant="primary" onClick={openAddProject}>
            <Icon name="plus" />
            Añadir proyecto
          </Button>
        }
      />
      <AsyncBoundary state={projects} loadingLabel="Cargando proyectos…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              title="Aún no hay proyectos vigilados."
              description="Añade la carpeta de un repositorio git y Duelo revisará cada commit y push."
              action={
                <Button variant="primary" onClick={openAddProject}>
                  Añadir proyecto
                </Button>
              }
            />
          ) : (
            <ul className="project-grid">
              {list.map((p) => (
                <li key={p.slug} className="project-card">
                  <div className="project-card-head">
                    <Link className="project-name" to={projectPath(p.slug)}>
                      {p.name}
                    </Link>
                    <span className="row">
                      {p.github && <Badge>GitHub</Badge>}
                      {p.path && <Badge>Local</Badge>}
                      {p.hooksInstalled && <Badge tone="ok">Hooks</Badge>}
                    </span>
                  </div>
                  {p.path && <p className="project-path">{p.path}</p>}
                  <div className="project-card-actions">
                    <Link className="button button-secondary button-sm" to={projectPath(p.slug)}>
                      Ver canal
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(p)}
                      aria-label={`Quitar proyecto ${p.name}`}
                    >
                      Quitar
                    </Button>
                  </div>
                </li>
              ))}
              <li>
                <button type="button" className="project-card project-add" onClick={openAddProject}>
                  <Icon name="plus" />
                  Añadir proyecto
                </button>
              </li>
            </ul>
          )
        }
      </AsyncBoundary>
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
      {notice && <Toast message={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}
