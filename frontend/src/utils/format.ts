const NO_DATA = "—";

const decimal = (value: number) => String(value).replace(".", ",");

/** «—» si se desconoce; si no, `850 ms`, `4,2 s`, `42 s` o `2 min 5 s`. */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return NO_DATA;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = Math.round(ms / 100) / 10;
  if (seconds < 10) return `${decimal(seconds)} s`;
  const whole = Math.round(ms / 1000);
  if (whole < 60) return `${whole} s`;
  const rest = whole % 60;
  return rest === 0 ? `${Math.floor(whole / 60)} min` : `${Math.floor(whole / 60)} min ${rest} s`;
}

/** «—» si se desconoce; si no, el número con un decimal como mucho (`8`, `4,1`). */
export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || !Number.isFinite(score)) return NO_DATA;
  return decimal(Math.round(score * 10) / 10);
}

/** «3 cambios», «1 cambio». */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
