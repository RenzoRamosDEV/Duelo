import { Suspense, useCallback, useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";
import { ProjectsProvider } from "../hooks/useProjects";
import { Brand } from "./Brand";
import { SidebarNav } from "./SidebarNav";

/**
 * Marco de la aplicación: barra lateral fija a partir de 1024 px y, por debajo, cabecera con
 * «Menú» que abre la misma navegación en un cajón modal (<dialog>: foco atrapado, Escape y el
 * foco vuelve solo al botón al cerrarse).
 */
export function AppLayout() {
  const drawer = useRef<HTMLDialogElement>(null);
  const { pathname } = useLocation();

  const closeDrawer = useCallback(() => {
    if (drawer.current?.open) drawer.current.close();
  }, []);

  const openDrawer = () => {
    const dialog = drawer.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
  };

  // Navegar cierra el cajón aunque el destino sea la misma ruta.
  useEffect(() => {
    closeDrawer();
  }, [closeDrawer]);

  const onBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target === drawer.current) closeDrawer();
  };

  return (
    <ProjectsProvider>
      <div className="app">
        <a className="skip-link" href="#main">
          Saltar al contenido
        </a>
        <header className="topbar">
          <button
            type="button"
            className="button button-ghost"
            aria-controls="drawer"
            aria-haspopup="dialog"
            onClick={openDrawer}
          >
            Menú
          </button>
          <Brand />
        </header>
        <aside className="sidebar">
          <Brand />
          <SidebarNav />
        </aside>
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: el cierre por teclado lo da Escape, nativo del diálogo. */}
        <dialog
          id="drawer"
          ref={drawer}
          className="drawer"
          aria-label="Menú"
          onClick={onBackdropClick}
        >
          <div className="drawer-panel">
            <div className="drawer-head">
              <Brand />
              <button type="button" className="button button-ghost" onClick={closeDrawer}>
                Cerrar
              </button>
            </div>
            <SidebarNav onNavigate={closeDrawer} />
          </div>
        </dialog>
        <main id="main" className="content" tabIndex={-1}>
          <Suspense key={pathname} fallback={<output>Cargando…</output>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </ProjectsProvider>
  );
}
