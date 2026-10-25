/** Esqueleto decorativo de filas mientras carga una lista; oculto a la tecnología asistiva. */
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: filas idénticas y sin estado
        <div key={index} className="skeleton-row" />
      ))}
    </div>
  );
}
