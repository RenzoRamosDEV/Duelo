/** Cierto para rutas absolutas POSIX (`/home/me/repo`) y Windows (`C:\repo`, `C:/repo`). */
export function isAbsolutePath(path: string): boolean {
  return /^(\/|[A-Za-z]:[\\/])/.test(path.trim());
}

/**
 * `owner/repo` a partir de los dos últimos segmentos de una ruta local (el mock no tiene remoto
 * git que leer); un solo segmento da solo ese nombre. "" para una raíz.
 */
export function slugFromPath(path: string): string {
  const segments = path
    .trim()
    .split(/[\\/]+/)
    .filter((s) => s !== "" && !/^[A-Za-z]:$/.test(s));
  return segments.slice(-2).join("/");
}
