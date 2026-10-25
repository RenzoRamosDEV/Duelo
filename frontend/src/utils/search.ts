import type { Change } from "../types";

/** Coincidencia sin mayúsculas en título, autor, SHA o rama (la misma regla que el `q` del servidor). */
export function matchesQuery(change: Change, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [change.title, change.author, change.sha, change.ref].some((v) =>
    v.toLowerCase().includes(q),
  );
}
