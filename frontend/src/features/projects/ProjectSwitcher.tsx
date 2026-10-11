import { useId } from "react";
import { useLocation, useNavigate } from "react-router";
import { parseProjectPath, projectPath } from "../../lib/projectPath";
import { useProjects } from "./ProjectsContext";

const ADD = "\u0000add";

/**
 * The project the user is in, as a native `<select>` in the top bar, to jump to another one without
 * going back to the entry page. It only shows up under `/p/…` and once the list has loaded.
 */
export function ProjectSwitcher() {
  const { projects, openAddProject } = useProjects();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const id = useId();
  const route = parseProjectPath(pathname.startsWith("/p/") ? pathname.slice(3) : undefined);
  if (route.kind === "none" || projects.status !== "ready") return null;
  const known = projects.data.some((p) => p.slug === route.slug);

  return (
    <div className="project-switcher">
      <label className="visually-hidden" htmlFor={id}>
        Proyecto
      </label>
      <select
        id={id}
        value={known ? route.slug : ""}
        onChange={(e) => {
          if (e.target.value === ADD) openAddProject();
          else if (e.target.value) navigate(projectPath(e.target.value));
        }}
      >
        {!known && (
          <option value="" disabled>
            {route.slug}
          </option>
        )}
        {projects.data.map((p) => (
          <option key={p.slug} value={p.slug}>
            {p.name}
          </option>
        ))}
        <option value={ADD}>Añadir proyecto…</option>
      </select>
    </div>
  );
}
