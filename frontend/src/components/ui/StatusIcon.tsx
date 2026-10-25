import type { Tone } from "./Badge";

const GLYPH: Record<Exclude<Tone, "info">, string> = {
  ok: "✓",
  warn: "●",
  err: "✕",
  neutral: "○",
};

interface Props {
  tone: Exclude<Tone, "info">;
  /** Texto alternativo; sin él el icono es decorativo (el texto va al lado). */
  label?: string;
  /** Glifo distinto del que corresponde al tono (p. ej. ↶ para un commit deshecho). */
  glyph?: string;
}

/** ✓ ok, ● en curso, ✕ fallo: 16 px, sin caja, con el color semántico. */
export function StatusIcon({ tone, label, glyph }: Props) {
  return (
    <span className="status-icon" data-tone={tone}>
      <span aria-hidden="true">{glyph ?? GLYPH[tone]}</span>
      {label && <span className="visually-hidden">{label}</span>}
    </span>
  );
}
