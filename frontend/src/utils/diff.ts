export type DiffRowKind = "header" | "meta" | "add" | "del" | "context";

export interface DiffRow {
  id: number;
  kind: DiffRowKind;
  text: string;
  oldNo?: number;
  newNo?: number;
  /** Solo en la fila de cabecera que abre un archivo (`@@ <archivo>` o `diff --git`). */
  file?: string;
}

export interface DiffFile {
  name: string;
  additions: number;
  deletions: number;
  /** Id de la fila donde empieza el archivo; la página ancla la sección en ella. */
  rowId: number;
}

export const UNNAMED_FILE = "(sin nombre)";

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;
const GIT_HEADER = /^diff --git a\/.+? b\/(.+)$/;

function gitFileName(line: string): string {
  const m = GIT_HEADER.exec(line);
  return m ? m[1] : line.slice("diff --git ".length).trim() || UNNAMED_FILE;
}

/**
 * Convierte un diff unificado en filas numeradas. Entiende tres cabeceras: `@@ -a,b +c,d @@`
 * (hunk, fija los contadores), `@@ <archivo>` (cabecera de archivo, reinicia ambos a 1) y el
 * bloque `diff --git`, cuyas líneas `index`/`---`/`+++` son metadatos, no cambios. Los metadatos
 * solo se reconocen entre `diff --git` y el primer hunk.
 */
export function parseDiff(diff: string): DiffRow[] {
  let oldNo = 1;
  let newNo = 1;
  let inGitHeader = false;
  return diff.split("\n").map((text, id): DiffRow => {
    if (text.startsWith("diff --git ")) {
      inGitHeader = true;
      oldNo = 1;
      newNo = 1;
      return { id, kind: "header", text, file: gitFileName(text) };
    }
    if (text.startsWith("@@")) {
      inGitHeader = false;
      const m = HUNK.exec(text);
      oldNo = m ? Number(m[1]) : 1;
      newNo = m ? Number(m[2]) : 1;
      return m
        ? { id, kind: "header", text }
        : { id, kind: "header", text, file: text.slice(2).trim() || UNNAMED_FILE };
    }
    if (inGitHeader) return { id, kind: "meta", text };
    if (text.startsWith("+")) return { id, kind: "add", text, newNo: newNo++ };
    if (text.startsWith("-")) return { id, kind: "del", text, oldNo: oldNo++ };
    return { id, kind: "context", text, oldNo: oldNo++, newNo: newNo++ };
  });
}

/** Agrupa las filas por archivo con sus recuentos; sin cabecera de archivo, uno sin nombre. */
export function diffFiles(rows: DiffRow[]): DiffFile[] {
  const files: DiffFile[] = [];
  let current: DiffFile | undefined;
  for (const row of rows) {
    if (row.file !== undefined) {
      current = { name: row.file, additions: 0, deletions: 0, rowId: row.id };
      files.push(current);
    } else if (row.kind === "header" || row.kind === "add" || row.kind === "del") {
      current ??=
        files[files.push({ name: UNNAMED_FILE, additions: 0, deletions: 0, rowId: row.id }) - 1];
      if (row.kind === "add") current.additions += 1;
      if (row.kind === "del") current.deletions += 1;
    }
  }
  return files;
}

/** Barra de cinco cuadrados de un archivo: cuántos son adiciones, borrados y neutros. */
export function diffSquares(
  additions: number,
  deletions: number,
): { add: number; del: number; neutral: number } {
  const total = additions + deletions;
  if (total === 0) return { add: 0, del: 0, neutral: 5 };
  let add = Math.round((additions / total) * 5);
  if (additions > 0 && add === 0) add = 1;
  if (deletions > 0 && add === 5) add = 4;
  return { add, del: 5 - add, neutral: 0 };
}
