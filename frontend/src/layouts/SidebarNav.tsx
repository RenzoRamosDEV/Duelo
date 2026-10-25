import { NavLink } from "react-router";
import { Icon } from "../components/ui/Icon";
import { useProjects } from "../hooks/useProjects";
import { type ApiStatus, useApiStatus } from "../services/source";
import { projectPath } from "../utils/paths";

type Props = {
  /** Se llama al pulsar un enlace o una acción; el cajón móvil lo usa para cerrarse. */
  onNavigate?: () => void;
};

const STATUS: Record<ApiStatus, { text: string; tone: "ok" | "warn" | "err" | "neutral" }> = {
  mock: { text: "Datos de ejemplo", tone: "neutral" },
  loading: { text: "Conectando…", tone: "neutral" },
  ok: { text: "API conectada", tone: "ok" },
  degraded: { text: "API degradada", tone: "warn" },
  offline: { text: "Sin conexión con la API", tone: "err" },
};

function ConnectionStatus() {
  const status = STATUS[useApiStatus()];
  return (
    <output className="nav-status" data-tone={status.tone}>
      <span className="nav-status-dot" aria-hidden="true" />
      {status.text}
    </output>
  );
}

export function SidebarNav({ onNavigate }: Props) {
  const { projects, openAddProject } = useProjects();
  const list = projects.status === "ready" ? projects.data : null;
  return (
    <nav className="nav" aria-label="Principal">
      <ul className="nav-group">
        <li>
          <NavLink to="/" end className="nav-link" onClick={onNavigate}>
            <Icon name="folder" />
            Proyectos
          </NavLink>
        </li>
        <li>
          <NavLink to="/stats" className="nav-link" onClick={onNavigate}>
            <Icon name="chart" />
            Estadísticas
          </NavLink>
        </li>
      </ul>
      <div className="nav-group">
        <p className="label nav-title">Proyectos vigilados</p>
        {list && list.length === 0 && <p className="nav-empty">Ninguno todavía.</p>}
        {list && list.length > 0 && (
          <ul className="nav-group">
            {list.map((project) => (
              <li key={project.slug}>
                <NavLink
                  to={projectPath(project.slug)}
                  className="nav-link nav-link-mono"
                  onClick={onNavigate}
                >
                  {project.slug}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="nav-link nav-action"
          onClick={() => {
            onNavigate?.();
            openAddProject();
          }}
        >
          <Icon name="plus" />
          Añadir proyecto
        </button>
      </div>
      <div className="nav-foot">
        <ConnectionStatus />
        <NavLink to="/settings" className="nav-link" onClick={onNavigate}>
          <Icon name="gear" />
          Ajustes
        </NavLink>
      </div>
    </nav>
  );
}
