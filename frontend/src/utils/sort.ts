export type SortDirection = "ascending" | "descending";

export interface SortState<K> {
  key: K;
  direction: SortDirection;
}

/**
 * Copia ordenada de `rows` por `key`. Los números se comparan como números, lo demás con
 * `localeCompare`; `null`/`undefined` van siempre al final. Es estable.
 */
export function sortRows<T, K extends keyof T>(
  rows: readonly T[],
  key: K,
  direction: SortDirection,
): T[] {
  const sign = direction === "ascending" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const x = a.row[key];
      const y = b.row[key];
      const missingX = x === null || x === undefined;
      const missingY = y === null || y === undefined;
      if (missingX || missingY)
        return missingX === missingY ? a.index - b.index : missingX ? 1 : -1;
      const order =
        typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), "es", { numeric: true });
      return order !== 0 ? sign * order : a.index - b.index;
    })
    .map(({ row }) => row);
}

/** Siguiente estado al pulsar una cabecera: la misma columna invierte; una nueva empieza ascendente. */
export function nextSort<K>(current: SortState<K> | null, key: K): SortState<K> {
  if (current?.key === key) {
    return { key, direction: current.direction === "ascending" ? "descending" : "ascending" };
  }
  return { key, direction: "ascending" };
}
