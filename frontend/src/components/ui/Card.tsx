import type { ReactNode } from "react";

interface Props {
  /** Título de la caja; la convierte en una sección con encabezado. */
  title?: string;
  /** Controles a la derecha del título. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Superficie con borde de 1 px; el texto secundario dentro usa el verde que contrasta sobre ella. */
export function Card({ title, actions, className, children }: Props) {
  const classes = className ? `card ${className}` : "card";
  if (!title) return <div className={classes}>{children}</div>;
  return (
    <section className={classes}>
      <header className="card-head">
        <h2>{title}</h2>
        {actions}
      </header>
      {children}
    </section>
  );
}
