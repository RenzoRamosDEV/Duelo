import type { Change, CommitState } from "../types";
import { shortSha } from "./url";

/** Lo que la interfaz dice de un commit que ya no está «activo». */
export interface UndoneNotice {
  state: Exclude<CommitState, "active">;
  /** Titular en mayúsculas de la fila y del aviso del detalle. */
  label: string;
  /** Línea pequeña bajo el titular. */
  subtitle: string;
}

/**
 * Aviso de un commit deshecho o revertido, o `null` para cualquier otro change. Una PR nunca se
 * deshace, diga lo que diga el servidor: el estado solo significa algo para commits.
 */
export function undoneNotice(
  change: Pick<Change, "kind" | "commitState" | "revertedBy">,
): UndoneNotice | null {
  if (change.kind !== "commit") return null;
  if (change.commitState === "discarded") {
    return { state: "discarded", label: "COMMIT DESHECHO", subtitle: "Ya no está en la rama" };
  }
  if (change.commitState === "reverted") {
    return {
      state: "reverted",
      label: "COMMIT REVERTIDO",
      subtitle: change.revertedBy
        ? `Revertido por ${shortSha(change.revertedBy.sha)}`
        : "Revertido por otro commit",
    };
  }
  return null;
}

/** «2 deshechos · 1 revertido» de los changes cargados; vacío si no hay ninguno. */
export function undoneCounts(items: readonly Pick<Change, "kind" | "commitState">[]): string {
  const count = (state: CommitState) =>
    items.filter((c) => c.kind === "commit" && c.commitState === state).length;
  const discarded = count("discarded");
  const reverted = count("reverted");
  return [
    discarded > 0 && `${discarded} ${discarded === 1 ? "deshecho" : "deshechos"}`,
    reverted > 0 && `${reverted} ${reverted === 1 ? "revertido" : "revertidos"}`,
  ]
    .filter(Boolean)
    .join(" · ");
}
