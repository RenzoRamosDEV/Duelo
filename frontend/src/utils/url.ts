/** Devuelve la URL solo si es http(s); las URL de los changes vienen de la ingesta y no son de fiar. */
export function safeHttpUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}
