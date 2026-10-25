/**
 * Indicador de actividad en texto: la etiqueta y un cursor de bloque. Es una región de estado
 * (`<output>`), así que el lector de pantalla anuncia la etiqueta; el cursor es decorativo.
 */
export function Loader({ label, inline = false }: { label: string; inline?: boolean }) {
  return (
    <output className={inline ? "loader loader-inline" : "loader"}>
      <span>{label}</span>
      <span className="loader-cursor" aria-hidden="true">
        ▌
      </span>
    </output>
  );
}
