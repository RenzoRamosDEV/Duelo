import type { ReactNode } from "react";

interface Props {
  /** Nombre accesible de la región desplazable. */
  label: string;
  /** `scroll`: desplazamiento horizontal dentro de su caja; `cards`: en móvil cada fila es una tarjeta. */
  variant?: "scroll" | "cards";
  children: ReactNode;
}

/**
 * Tabla que nunca rompe el layout: en móvil se desplaza dentro de su caja o pasa a tarjetas (cada
 * celda lleva `data-label` con el nombre de su columna).
 */
export function Table({ label, variant = "scroll", children }: Props) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: una región con scroll debe poder enfocarse para desplazarla con el teclado
    <section className="table-wrap" data-variant={variant} aria-label={label} tabIndex={0}>
      <table className="table">{children}</table>
    </section>
  );
}
