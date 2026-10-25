const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MAX_RELATIVE_DAYS = 30;

/**
 * Antigüedad tipo «hace 12 min» de una fecha ISO respecto a `now`. `null` si la fecha no vale,
 * «hace un momento» por debajo de un minuto o en el futuro (reloj desfasado); pasados 30 días,
 * la fecha local.
 */
export function relativeTime(iso: string, now: Date): string | null {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const elapsed = now.getTime() - then;
  if (elapsed < MINUTE) return "hace un momento";
  if (elapsed < HOUR) return `hace ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `hace ${Math.floor(elapsed / HOUR)} h`;
  const days = Math.floor(elapsed / DAY);
  if (days <= MAX_RELATIVE_DAYS) return `hace ${days} ${days === 1 ? "día" : "días"}`;
  return new Date(then).toLocaleDateString("es-ES");
}

/** Fecha y hora completas en español para el `title` de una antigüedad. */
export function absoluteTime(iso: string): string | undefined {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleString("es-ES");
}
