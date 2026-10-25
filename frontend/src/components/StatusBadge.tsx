import type { ReviewAggregate } from "../types";
import { AGGREGATE_GLYPH, AGGREGATE_LABEL, AGGREGATE_TONE } from "../utils/reviewStatus";
import { Badge } from "./ui/Badge";

/** Estado de una review o de un change: glifo y texto, para que no dependa del color. */
export function StatusBadge({ status }: { status: ReviewAggregate }) {
  return (
    <Badge tone={AGGREGATE_TONE[status]}>
      <span aria-hidden="true">{AGGREGATE_GLYPH[status]} </span>
      {AGGREGATE_LABEL[status]}
    </Badge>
  );
}
