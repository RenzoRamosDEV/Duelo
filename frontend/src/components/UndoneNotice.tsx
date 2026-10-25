import { Link } from "react-router";
import type { Change } from "../types";
import { type UndoneNotice, undoneNotice } from "../utils/commitState";
import { changePath } from "../utils/paths";
import { shortSha } from "../utils/url";

/** La etiqueta de una fila del canal: el titular en mayúsculas y su subtítulo. */
export function UndoneLabel({ notice }: { notice: UndoneNotice }) {
  return (
    <span className="undone-label" data-state={notice.state}>
      <strong>{notice.label}</strong> {notice.subtitle}
    </span>
  );
}

/** El mismo aviso como banda al principio del detalle, enlazando al revert si se conoce. */
export function UndoneBanner({ change, slug }: { change: Change; slug: string }) {
  const notice = undoneNotice(change);
  if (!notice) return null;
  return (
    <aside className="undone-banner" data-state={notice.state} aria-label="Estado del commit">
      <span className="undone-glyph" aria-hidden="true">
        ↶
      </span>
      <div>
        <strong>{notice.label}</strong>
        <p>
          {notice.state === "reverted" && change.revertedBy ? (
            <>
              Revertido por{" "}
              <Link className="mono" to={changePath(slug, change.revertedBy.id)}>
                {shortSha(change.revertedBy.sha)}
              </Link>
              .
            </>
          ) : (
            `${notice.subtitle}.`
          )}{" "}
          Sus reviews se conservan.
        </p>
      </div>
    </aside>
  );
}
