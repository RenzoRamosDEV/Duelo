import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "ok" | "alert" | "inverse";

/** Etiqueta corta en monospace. */
export function Badge({
  tone = "neutral",
  title,
  children,
}: {
  tone?: BadgeTone;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
    </span>
  );
}
