import { Link, Route, Routes, useParams } from "react-router";
import { EmptyState } from "./components/EmptyState";
import { UpdatePrompt } from "./components/UpdatePrompt";
import { HERO } from "./components/brand";
import { ChannelPage } from "./features/channel/ChannelPage";
import { ProjectPicker } from "./features/projects/ProjectPicker";
import { ChangeDetailPage } from "./features/review/ChangeDetailPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { StatsPage } from "./features/stats/StatsPage";
import { Shell } from "./layout/Shell";
import { parseProjectPath } from "./lib/projectPath";

function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        kind="missing"
        hero={HERO}
        heading
        title="No encontrado"
        action={
          <Link className="btn btn-primary" to="/">
            Volver al inicio
          </Link>
        }
      >
        <p className="muted">Esta dirección no corresponde a ninguna página.</p>
      </EmptyState>
    </div>
  );
}

/** `p/*`: the slug can contain "/", so the route is parsed by hand (see `lib/projectPath`). */
function ProjectRoute() {
  const route = parseProjectPath(useParams()["*"]);
  if (route.kind === "channel") return <ChannelPage key={route.slug} slug={route.slug} />;
  if (route.kind === "change") return <ChangeDetailPage slug={route.slug} id={route.id} />;
  return <NotFoundPage />;
}

function App() {
  return (
    <>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<ProjectPicker />} />
          <Route path="p/*" element={<ProjectRoute />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      {/* The service worker only exists in the production build; dev and tests never register it. */}
      {import.meta.env.PROD && <UpdatePrompt />}
    </>
  );
}

export default App;
