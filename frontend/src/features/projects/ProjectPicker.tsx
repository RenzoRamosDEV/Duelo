import { Link } from "react-router";
import { AsyncBoundary } from "../../components/AsyncBoundary";
import { EmptyState } from "../../components/EmptyState";
import { HERO } from "../../components/brand";
import { MetalButton } from "../../components/fx/MetalButton";
import { FolderIcon, PlusIcon } from "../../components/icons";
import { Badge } from "../../components/ui/Badge";
import { projectPath } from "../../lib/projectPath";
import { useProjects } from "./ProjectsContext";

/** The entry page: pick the project to look at. It never jumps to one on its own. */
export function ProjectPicker() {
  const { projects, openAddProject } = useProjects();
  return (
    <div className="page">
      <div className="page-header">
        <h1>Proyectos</h1>
        <p className="muted">Elige el repositorio cuyos commits y PRs quieres ver.</p>
      </div>
      <AsyncBoundary state={projects} loadingLabel="Cargando proyectos…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              hero={HERO}
              title="Aún no hay proyectos vigilados."
              action={
                <MetalButton variant="primary" onClick={openAddProject}>
                  Añadir proyecto
                </MetalButton>
              }
            >
              <p className="muted">
                Añade la carpeta de un repositorio git y Duelo revisará cada commit y push.
              </p>
            </EmptyState>
          ) : (
            <ul className="project-grid">
              {list.map((p) => (
                <li key={p.slug}>
                  <Link className="project-card" to={projectPath(p.slug)}>
                    <strong className="project-name">{p.name}</strong>
                    <span className="project-tags">
                      {p.github && <Badge tone="accent">GitHub</Badge>}
                      {p.path && <Badge>Local</Badge>}
                      {p.hooksInstalled && <Badge tone="success">Hooks</Badge>}
                    </span>
                    {p.path && (
                      <span className="project-path mono muted">
                        <FolderIcon size={12} /> {p.path}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" className="project-card project-add" onClick={openAddProject}>
                  <PlusIcon />
                  <span>Añadir proyecto</span>
                </button>
              </li>
            </ul>
          )
        }
      </AsyncBoundary>
    </div>
  );
}
