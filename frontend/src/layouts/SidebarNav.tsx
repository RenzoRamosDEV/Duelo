import { NavLink } from "react-router";
import { useProjects } from "../hooks/useProjects";
import { projectPath } from "../utils/paths";

type Props = {
  /** Se llama al pulsar un enlace o una acción; el cajón móvil lo usa para cerrarse. */
  onNavigate?: () => void;
};

const LINKS = [
  { to: "/", label: "Proyectos", end: true },
  { to: "/stats", label: "Estadísticas", end: false },
  { to: "/settings", label: "Ajustes", end: false },
];

export function SidebarNav({ onNavigate }: Props) {
  const { projects, openAddProject } = useProjects();
  const list = projects.status === "ready" ? projects.data : null;
  return (
    <nav className="nav" aria-label="Principal">
      <ul className="nav-group">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end} className="nav-link" onClick={onNavigate}>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="nav-group">
        <p className="nav-title">Proyectos vigilados</p>
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
          className="nav-link nav-link-mono nav-action"
          onClick={() => {
            onNavigate?.();
            openAddProject();
          }}
        >
          + Añadir proyecto
        </button>
      </div>
    </nav>
  );
}
