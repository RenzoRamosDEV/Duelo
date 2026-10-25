import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { AddProjectDialog } from "../components/AddProjectDialog";
import { useDataSource } from "../services/source";
import type { ProjectRef } from "../types";
import { sameValue } from "../utils/equal";
import { projectPath } from "../utils/paths";
import { PROJECTS_POLL_MS } from "../utils/polling";
import { type AsyncResult, type AsyncState, useAsync } from "./useAsync";

interface ProjectsValue {
  projects: AsyncState<ProjectRef[]> & AsyncResult;
  openAddProject: () => void;
}

const ProjectsContext = createContext<ProjectsValue | null>(null);

/**
 * Una sola lista viva de proyectos para la portada, la barra lateral y Ajustes, más el diálogo
 * «Añadir proyecto», de modo que añadir o quitar uno se refleja en todas partes a la vez.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const source = useDataSource();
  const navigate = useNavigate();
  const projects = useAsync(
    useCallback((signal: AbortSignal) => source.projects({ signal }), [source]),
    { pollMs: PROJECTS_POLL_MS, equals: sameValue },
  );
  const [adding, setAdding] = useState(false);
  const { status, retry, refresh, liveness } = projects;
  const data = projects.status === "ready" ? projects.data : undefined;
  const error = projects.status === "error" ? projects.error : undefined;

  const openAddProject = useCallback(() => setAdding(true), []);
  // `useAsync` devuelve un objeto nuevo en cada render; sus campos dicen cuándo cambió la lista.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depende de los campos, no del envoltorio
  const stable = useMemo(() => projects, [status, data, error, retry, refresh, liveness]);
  const value = useMemo(() => ({ projects: stable, openAddProject }), [stable, openAddProject]);

  return (
    <ProjectsContext.Provider value={value}>
      {children}
      {adding && (
        <AddProjectDialog
          onClose={() => setAdding(false)}
          onAdded={(project) => {
            setAdding(false);
            refresh();
            navigate(projectPath(project.slug));
          }}
        />
      )}
    </ProjectsContext.Provider>
  );
}

export function useProjects(): ProjectsValue {
  const value = useContext(ProjectsContext);
  if (!value) throw new Error("useProjects solo funciona dentro de ProjectsProvider");
  return value;
}
