import { useMemo } from "react";
import { UNNAMED_FILE, diffFiles, diffSquares, parseDiff } from "../utils/diff";
import { plural } from "../utils/format";

const fileAnchor = (rowId: number) => `diff-file-${rowId}`;

/** La barra de cinco cuadrados junto al +N −M de un archivo; decorativa. */
function Squares({ additions, deletions }: { additions: number; deletions: number }) {
  const { add, del, neutral } = diffSquares(additions, deletions);
  const squares = [
    ...Array.from({ length: add }, () => "add"),
    ...Array.from({ length: del }, () => "del"),
    ...Array.from({ length: neutral }, () => "neutral"),
  ];
  return (
    <span className="squares" aria-hidden="true">
      {squares.map((kind, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cinco cuadrados fijos y decorativos
        <span key={i} data-kind={kind} />
      ))}
    </span>
  );
}

/** El diff se analiza una vez por texto, con sus archivos y totales. */
export function useParsedDiff(text: string) {
  return useMemo(() => {
    const rows = parseDiff(text);
    const files = diffFiles(rows);
    return {
      rows,
      files,
      anchored: new Set(files.map((f) => f.rowId)),
      totalAdd: files.reduce((n, f) => n + f.additions, 0),
      totalDel: files.reduce((n, f) => n + f.deletions, 0),
    };
  }, [text]);
}

/** Archivos cambiados: totales, índice con anclas y la tabla del diff. */
export function DiffView({ diff, truncated }: { diff: string; truncated?: boolean }) {
  const { rows, files, anchored, totalAdd, totalDel } = useParsedDiff(diff);
  return (
    <div className="diff-view stack">
      <div className="diff-head">
        <h3>{plural(files.length, "archivo cambiado", "archivos cambiados")}</h3>
        {files.length > 0 && (
          <span className="diff-totals mono">
            <span className="add-count">+{totalAdd}</span>{" "}
            <span className="del-count">−{totalDel}</span>
          </span>
        )}
      </div>
      {truncated && (
        <p className="diff-truncated" role="note">
          El diff está truncado: solo se muestra una parte de los cambios.
        </p>
      )}
      {files.some((f) => f.name !== UNNAMED_FILE) && (
        <nav className="diff-files" aria-label="Archivos del diff">
          <ul>
            {files.map((f) => (
              <li key={f.rowId}>
                <a href={`#${fileAnchor(f.rowId)}`} className="mono">
                  {f.name}
                </a>
                <span className="file-stat mono">
                  <span className="add-count">+{f.additions}</span>{" "}
                  <span className="del-count">−{f.deletions}</span>
                  <Squares additions={f.additions} deletions={f.deletions} />
                </span>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="diff-scroll">
        <table className="diff" aria-label="Diff">
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                id={anchored.has(row.id) ? fileAnchor(row.id) : undefined}
                className={`diff-row ${row.kind}`}
                data-file={row.kind === "header" && row.file ? "" : undefined}
              >
                <td className="ln" aria-hidden="true">
                  {row.oldNo ?? ""}
                </td>
                <td className="ln" aria-hidden="true">
                  {row.newNo ?? ""}
                </td>
                <td className="code">
                  {row.kind === "header" ? (
                    <strong>{row.file ?? row.text.replace(/^@@\s*/, "")}</strong>
                  ) : (
                    row.text
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
