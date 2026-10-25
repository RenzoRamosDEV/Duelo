import type { ReviewAggregate } from "../types";
import type { UndoneNotice } from "../utils/commitState";
import { AGGREGATE_GLYPH, AGGREGATE_LABEL, AGGREGATE_TONE } from "../utils/reviewStatus";

interface Props {
  status: ReviewAggregate | undefined;
  /** Un commit deshecho o revertido muestra la flecha de deshacer en lugar de su estado. */
  undone?: UndoneNotice | null;
}

/** Glifo de estado de una fila; su texto alternativo es la etiqueta del estado. */
export function StatusMark({ status, undone }: Props) {
  if (undone) {
    return (
      <span className="status-mark" data-tone="alert">
        <span aria-hidden="true">↶</span>
        <span className="visually-hidden">{undone.label}</span>
      </span>
    );
  }
  if (!status) return <span className="status-mark" data-tone="neutral" aria-hidden="true" />;
  return (
    <span className="status-mark" data-tone={AGGREGATE_TONE[status]}>
      <span aria-hidden="true">{AGGREGATE_GLYPH[status]}</span>
      <span className="visually-hidden">{AGGREGATE_LABEL[status]}</span>
    </span>
  );
}
