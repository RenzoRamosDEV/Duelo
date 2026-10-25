/** Igualdad estructural para datos JSON (respuestas de la API); barata para una página de resultados. */
export function sameValue<T>(a: T, b: T): boolean {
  return a === b || JSON.stringify(a) === JSON.stringify(b);
}
