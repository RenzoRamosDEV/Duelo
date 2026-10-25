const MAX_LENGTH = 200;
const HIDDEN = "[oculto]";

// biome-ignore lint/suspicious/noControlCharactersInRegex: quitar los caracteres de control es el objetivo
const CONTROL = /[\u0000-\u001f\u007f-\u009f]+/g;
// El valor de `Authorization: Bearer abc` es `abc`, no `Bearer`: el esquema se consume con él.
const SECRET_PAIR =
  /\b(token|secret|password|passwd|api[_-]?key|authorization)(\s*[=:]\s*)(?:(?:Bearer|Basic)\s+)?\S+/gi;
const BEARER = /\bBearer\s+\S+/gi;
// Credenciales con forma reconocible (el mismo criterio que `redact_secrets` del backend).
const KEY_SHAPES = [
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
];

/**
 * Hace mostrable un motivo de fallo del servidor: sin caracteres de control, espacios
 * colapsados, valores con pinta de secreto ocultos y longitud acotada. `null` si no queda nada.
 */
export function sanitizeError(text: string | null | undefined, max = MAX_LENGTH): string | null {
  if (!text) return null;
  let clean = text
    .replace(CONTROL, " ")
    .replace(SECRET_PAIR, `$1$2${HIDDEN}`)
    .replace(BEARER, `Bearer ${HIDDEN}`);
  for (const shape of KEY_SHAPES) clean = clean.replace(shape, HIDDEN);
  clean = clean.replace(/\s+/g, " ").trim();
  if (!clean) return null;
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}
