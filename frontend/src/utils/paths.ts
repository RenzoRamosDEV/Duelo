/**
 * Rutas de proyecto. Los slugs del backend son `owner/repo`, que un parámetro `:slug` no puede
 * capturar (nunca consume una «/»), así que la app tiene una sola ruta `p/*` y lee el resto con
 * `parseProjectPath`. Todo enlace interno a un proyecto o a un change se construye aquí.
 */
const encodeSlug = (slug: string) => slug.split("/").map(encodeURIComponent).join("/");

export function projectPath(slug: string): string {
  return `/p/${encodeSlug(slug)}`;
}

export function changePath(slug: string, id: string): string {
  return `${projectPath(slug)}/changes/${encodeURIComponent(id)}`;
}

export type ProjectRoute =
  | { kind: "channel"; slug: string }
  | { kind: "change"; slug: string; id: string }
  | { kind: "none" };

/**
 * Interpreta lo que sigue a `/p/`. Con tres o más segmentos y `changes` en el penúltimo es el
 * detalle de un change (el slug son los segmentos anteriores); si no, todo el resto es el slug de
 * un canal, así que un proyecto llamado `changes` o `x/changes` sigue siendo un canal.
 */
export function parseProjectPath(rest: string | undefined): ProjectRoute {
  const segments = (rest ?? "").split("/").filter((s) => s !== "");
  if (segments.length === 0) return { kind: "none" };
  if (segments.length >= 3 && segments[segments.length - 2] === "changes") {
    return {
      kind: "change",
      slug: segments.slice(0, -2).join("/"),
      id: segments[segments.length - 1],
    };
  }
  return { kind: "channel", slug: segments.join("/") };
}
