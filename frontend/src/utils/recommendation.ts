/** Etiquetas que los agentes ponen delante del consejo al final de un hallazgo, en minúsculas. */
const LABELS = [
  "arreglo",
  "sugerencia",
  "recomendación",
  "recomendacion",
  "recommendation",
  "suggestion",
  "fix",
];

/** Lo que puede ir justo antes de una etiqueta para que abra frase (o el texto). */
const SENTENCE_END = ".!?;)\n";

export interface SplitMessage {
  /** El hallazgo en sí, sin el consejo. */
  body: string;
  /** El consejo tras una etiqueta como `Arreglo:`, si el texto lo lleva. */
  recommendation: string | undefined;
}

/** Índice donde `etiqueta:` (o `**etiqueta:**`) abre frase, o -1. */
function labelAt(lower: string, label: string): number {
  let from = 0;
  for (;;) {
    const at = lower.indexOf(label, from);
    if (at === -1) return -1;
    from = at + label.length;

    let end = at + label.length;
    while (lower[end] === "*" || lower[end] === " ") end += 1;
    if (lower[end] !== ":") continue;

    let before = at - 1;
    while (before >= 0 && (lower[before] === " " || lower[before] === "*")) before -= 1;
    if (before < 0 || SENTENCE_END.includes(lower[before] as string)) return at;
  }
}

/**
 * Separa `... problema. Arreglo: haz esto` en el problema y el consejo. Sin etiqueta, todo es el
 * cuerpo. Si hay varias gana la primera.
 */
export function splitRecommendation(message: string): SplitMessage {
  const lower = message.toLowerCase();
  let best = -1;
  let bestLabel = "";
  for (const label of LABELS) {
    const at = labelAt(lower, label);
    if (at !== -1 && (best === -1 || at < best)) {
      best = at;
      bestLabel = label;
    }
  }
  if (best === -1) return { body: message.trim(), recommendation: undefined };

  let start = best + bestLabel.length;
  while (message[start] === "*" || message[start] === " ") start += 1;
  start += 1; // Los dos puntos.
  const recommendation = message
    .slice(start)
    .replace(/^[\s*]+/, "")
    .trim();
  return {
    body: message
      .slice(0, best)
      .replace(/[\s*]+$/, "")
      .trim(),
    recommendation: recommendation || undefined,
  };
}
