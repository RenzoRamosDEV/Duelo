import { type ReactNode, useId, useState } from "react";

/**
 * Qué textos largos ha abierto el usuario. Vive fuera de React para sobrevivir a los refrescos de
 * la página y a que el componente se monte de nuevo; está acotado (el más antiguo sale primero).
 */
const opened = new Map<string, true>();
const MAX_REMEMBERED = 500;

function remember(id: string, open: boolean): void {
  opened.delete(id);
  if (open) opened.set(id, true);
  while (opened.size > MAX_REMEMBERED) {
    const oldest = opened.keys().next().value;
    if (oldest === undefined) break;
    opened.delete(oldest);
  }
}

export interface LengthLimit {
  chars: number;
  lines: number;
}

/** Los resúmenes se leen enteros más a menudo que los hallazgos, así que tienen más margen. */
export const SUMMARY_LIMIT: LengthLimit = { chars: 480, lines: 8 };
export const FINDING_LIMIT: LengthLimit = { chars: 320, lines: 6 };

/** Se decide por longitud y no midiendo el DOM: es igual en cualquier pantalla. */
export function isLong(text: string, limit: LengthLimit): boolean {
  return text.length > limit.chars || text.split("\n").length > limit.lines;
}

/**
 * Muestra `children` plegado (altura limitada y botón «Ver más») cuando `long`, y tal cual si no.
 * `id` debe ser estable entre refrescos: es la clave con la que se recuerda si está abierto.
 */
export function Collapsible({
  id,
  long,
  children,
}: {
  id: string;
  long: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(() => opened.has(id));
  const regionId = useId();
  if (!long) return <>{children}</>;
  return (
    <div className="collapsible" data-open={open ? "true" : "false"}>
      <div className="collapsible-body" id={regionId}>
        {children}
      </div>
      <button
        type="button"
        className="collapsible-toggle"
        aria-expanded={open}
        aria-controls={regionId}
        onClick={() => {
          remember(id, !open);
          setOpen(!open);
        }}
      >
        {open ? "Ver menos" : "Ver más"}
      </button>
    </div>
  );
}
