import { Link } from "react-router";
import { AsyncBoundary } from "../components/AsyncBoundary";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { useProjects } from "../hooks/useProjects";
import { projectPath } from "../utils/paths";

/** La portada: elegir el proyecto que se quiere ver. Nunca salta a uno por su cuenta. */
export default function ProjectsPage() {
  const { projects, openAddProject } = useProjects();
  return (
    <div className="page">
      <header className="page-head">
        <h1 className="prompt cursor">Proyectos</h1>
        <p className="page-lead">Elige el repositorio cuyos commits y PRs quieres ver.</p>
      </header>
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
                <li key={p.slug}>
                  <Link className="project-card" to={projectPath(p.slug)}>
                    <strong className="project-name">{p.name}</strong>
                    <span className="row">
                      {p.github && <Badge tone="inverse">GitHub</Badge>}
                      {p.path && <Badge>Local</Badge>}
                      {p.hooksInstalled && <Badge tone="ok">Hooks</Badge>}
                    </span>
                    {p.path && <span className="project-path">{p.path}</span>}
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" className="project-card project-add" onClick={openAddProject}>
                  + Añadir proyecto
                </button>
              </li>
            </ul>
          )
        }
      </AsyncBoundary>
    </div>
  );
}
