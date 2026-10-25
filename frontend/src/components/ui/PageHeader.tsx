import type { ReactNode } from "react";

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Migas o contexto encima del título. */
  crumbs?: ReactNode;
  /** Chips y metadatos bajo el título. */
  meta?: ReactNode;
  /** Acciones a la derecha. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** Cabecera común de todas las páginas: título con prompt, subtítulo y acciones a la derecha. */
export function PageHeader({ title, subtitle, crumbs, meta, actions, children }: Props) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        {crumbs && (
          <nav className="page-header-crumbs" aria-label="Migas">
            {crumbs}
          </nav>
        )}
        <h1 className="prompt">{title}</h1>
        {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        {meta}
        {children}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
