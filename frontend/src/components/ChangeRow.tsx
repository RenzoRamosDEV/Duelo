import { memo } from "react";
import { Link } from "react-router";
import type { Change } from "../types";
import { undoneNotice } from "../utils/commitState";
import { sameValue } from "../utils/equal";
import { changePath } from "../utils/paths";
import { shortSha } from "../utils/url";
import { Age } from "./Age";
import { AgentChecks } from "./AgentChecks";
import { StatusMark } from "./StatusMark";
import { UndoneLabel } from "./UndoneNotice";
import { Badge } from "./ui/Badge";

interface Props {
  change: Change;
  slug: string;
  agentNames: readonly string[] | null;
}

// Cada refresco trae objetos nuevos, así que el change se compara por valor: un sondeo que cambia
// un change solo repinta su fila.
const sameRow = (a: Props, b: Props) =>
  a.slug === b.slug && a.agentNames === b.agentNames && sameValue(a.change, b.change);

/**
 * Una línea compacta por change. Toda la fila es el enlace a su página (el título es su único
 * elemento enfocable; su `::after` cubre la fila). Un commit que ya no está en su rama (o fue
 * revertido) va en ámbar, con su estado dicho en palabras dentro de la fila.
 */
export const ChangeRow = memo(function ChangeRow({ change, slug, agentNames }: Props) {
  const undone = undoneNotice(change);
  return (
    <li
      className="change"
      data-status={change.reviewStatus}
      data-undone={undone ? undone.state : undefined}
    >
      <StatusMark status={change.reviewStatus} undone={undone} />
      <div className="change-main">
        <Link className="change-link" to={changePath(slug, change.id)}>
          {change.title}
        </Link>
        <span className="row change-tags">
          <Badge>{change.kind === "pr" ? "PR" : "Commit"}</Badge>
          {undone && <UndoneLabel notice={undone} />}
        </span>
        <span className="change-meta">
          <span className="mono">#{shortSha(change.sha)}</span> · por {change.author}
          {change.createdAt && (
            <>
              {" · "}
              <Age iso={change.createdAt} />
            </>
          )}
        </span>
      </div>
      <AgentChecks reviews={change.reviews ?? []} run={change.run} expected={agentNames} />
    </li>
  );
}, sameRow);
