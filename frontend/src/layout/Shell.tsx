import { Suspense } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { BrandLogo } from "../components/BrandLogo";
import { Busy } from "../components/Busy";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { ChartIcon, GearIcon } from "../components/icons";
import { ProjectSwitcher } from "../features/projects/ProjectSwitcher";
import { ProjectsProvider } from "../features/projects/ProjectsContext";

const link = ({ isActive }: { isActive: boolean }) => (isActive ? "nav-link active" : "nav-link");

export function Shell() {
  const { pathname } = useLocation();
  return (
    <ProjectsProvider>
      <div className="app">
        <header className="topbar">
          <Link to="/" className="brand">
            <BrandLogo size={40} />
            <span>Duelo</span>
          </Link>
          <ProjectSwitcher />
          <div className="topbar-spacer" />
          <nav className="topbar-nav" aria-label="Principal">
            <NavLink to="/stats" className={link}>
              <ChartIcon />
              <span className="nav-text">Estadísticas</span>
            </NavLink>
            <NavLink to="/settings" className={link}>
              <GearIcon />
              <span className="nav-text">Ajustes</span>
            </NavLink>
          </nav>
          <ThemeSwitch compact />
        </header>
        <main className="main">
          {/* Keyed by page: navigations run in a transition, which would otherwise keep the old
              page on screen instead of «Cargando…» while a page's code arrives. */}
          <Suspense
            key={pathname}
            fallback={<Busy activity="load" label="Cargando…" className="busy-block" />}
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
    </ProjectsProvider>
  );
}
