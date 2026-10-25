export const DEFAULT_API_URL = "http://localhost:8000";

/**
 * `curl` mínimo para ingerir un commit en `slug`. El token es siempre el marcador `$INGEST_TOKEN`:
 * la interfaz nunca imprime un secreto real.
 */
export function ingestCommand(slug: string, apiUrl: string | undefined): string {
  const base = (apiUrl || DEFAULT_API_URL).replace(/\/+$/, "");
  const body = JSON.stringify({ project: slug, ref: "main", head_sha: "<sha del commit>" });
  return [
    `curl -X POST ${base}/ingest/commit`,
    `-H "Content-Type: application/json"`,
    `-H "X-Ingest-Token: $INGEST_TOKEN"`,
    `-d '${body.replaceAll("'", "'\\''")}'`,
  ].join(" \\\n  ");
}
