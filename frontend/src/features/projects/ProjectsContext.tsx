import { type ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useDataSource } from "../../data/source";
import type { ProjectRef } from "../../lib/api";
import { sameValue } from "../../lib/equal";
import { PROJECTS_FACTOR, usePollMs } from "../../lib/polling";
import { projectPath } from "../../lib/projectPath";
import { type AsyncResult, type AsyncState, useAsync } from "../../lib/useAsync";
import { AddProjectDialog } from "./AddProjectDialog";

interface ProjectsValue {
  projects: AsyncState<ProjectRef[]> & AsyncResult;
  openAddProject: () => void;
}

const ProjectsContext = createContext<ProjectsValue | null>(null);

/**
 * One shared, live list of projects for the entry page, the top-bar switcher and Settings, plus the "add
 * project" dialog, so adding or removing a project shows up everywhere at once.
 */
export function ProjectsProvider({ children }: { children: ReactNode }) {
  const source = useDataSource();
  const navigate = useNavigate();
  const projects = useAsync(
    useCallback((signal: AbortSignal) => source.projects({ signal }), [source]),
    {
      pollMs: usePollMs() * PROJECTS_FACTOR,
      equals: (a: ProjectRef[], b: ProjectRef[]) => sameValue(a, b),
    },
  );
  const [adding, setAdding] = useState(false);
  const { status, retry, refresh, liveness } = projects;
  const data = projects.status === "ready" ? projects.data : undefined;
  const error = projects.status === "error" ? projects.error : undefined;

  const openAddProject = useCallback(() => setAdding(true), []);
  // `useAsync` returns a new object on every render; its fields say when the list really changed.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on the fields, not the wrapper
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
  if (!value) throw new Error("useProjects must be used inside ProjectsProvider");
  return value;
}
