import { lazy } from "react";
import { Route, Routes, useParams } from "react-router";
import { AppLayout } from "./layouts/AppLayout";
import { parseProjectPath } from "./utils/paths";

const ProjectsPage = lazy(() => import("./pages/ProjectsPage"));
const ChannelPage = lazy(() => import("./pages/ChannelPage"));
const ChangeDetailPage = lazy(() => import("./pages/ChangeDetailPage"));
const StatsPage = lazy(() => import("./pages/StatsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

/** `/p/*`: el slug lleva barras, así que la ruta se interpreta a mano. */
function ProjectRoute() {
  const route = parseProjectPath(useParams()["*"]);
  if (route.kind === "change") {
    return <ChangeDetailPage key={route.id} />;
  }
  if (route.kind === "channel") {
    return <ChannelPage key={route.slug} />;
  }
  return <NotFoundPage />;
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<ProjectsPage />} />
        <Route path="p/*" element={<ProjectRoute />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
