import type { ReactNode } from "react";

interface Props {
  title: string;
  description?: string;
  /** Acción principal (botón o enlace). */
  action?: ReactNode;
  /** `h1` cuando el estado vacío es la página entera (no encontrado). */
  heading?: "h1" | "h2";
  children?: ReactNode;
}

/** Bloque de prompt para estados vacíos y páginas sin contenido. */
export function EmptyState({ title, description, action, heading = "h2", children }: Props) {
  const Heading = heading;
  return (
    <div className="empty">
      <Heading className="prompt">{title}</Heading>
      {description && <p className="empty-text">{description}</p>}
      {children}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
