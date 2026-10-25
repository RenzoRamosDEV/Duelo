import { useCallback, useEffect, useRef, useState } from "react";
import { useDataSource } from "../services/source";
import type { Change, ChangeKind, ChangePage } from "../types";
import { type StateFilter, statusesFor } from "../utils/channelQuery";
import { sameValue } from "../utils/equal";
import { mergeUnique } from "../utils/pagination";
import { IDLE_POLL_MS, POLL_MS } from "../utils/polling";
import { isWaiting } from "../utils/reviewStatus";
import { type AsyncResult, type AsyncState, useAsync } from "./useAsync";

/** Primera página etiquetada con la consulta que responde: nunca se enseña una vieja para otra nueva. */
interface Tagged {
  key: string;
  page: ChangePage;
}

interface More {
  /** Consulta a la que pertenecen las páginas extra; otra consulta las descarta. */
  key: string;
  items: Change[];
  cursor: string | null;
  state: "idle" | "loading" | "error";
}

export interface ChannelFilters {
  kind: ChangeKind | undefined;
  state: StateFilter;
  /** Texto de búsqueda ya con debounce; en blanco no hay búsqueda. */
  q: string;
}

/**
 * Primera página del canal de un proyecto más paginación por cursor. Todos los filtros los
 * resuelve el servidor. La primera página se refresca en segundo plano; las páginas extra y los
 * items ya mostrados van atados a la consulta (proyecto y filtros), no al objeto de la primera
 * página, así que un refresco con un change nuevo conserva todo lo cargado sin perder ni repetir
 * ninguno. Cambiar de proyecto o de filtro lo descarta, y una respuesta tardía de una consulta
 * antigua se ignora.
 */
export function useChannel(slug: string, { kind, state, q }: ChannelFilters) {
  const source = useDataSource();
  const [reviewing, setReviewing] = useState(true);
  const pollMs = reviewing ? POLL_MS : IDLE_POLL_MS;
  const key = JSON.stringify([slug, kind, state, q]);
  const tagged = useAsync(
    useCallback(
      async (signal: AbortSignal) => ({
        key,
        page: await source.changes(
          slug,
          { kind, status: statusesFor(state), q: q || undefined },
          { signal },
        ),
      }),
      [source, slug, kind, state, q, key],
    ),
    { pollMs, equals: (a: Tagged, b: Tagged) => sameValue(a, b) },
  );
  const [more, setMore] = useState<More | null>(null);
  const shown = useRef<{ key: string; items: Change[] }>({ key, items: [] });
  const currentKey = useRef(key);
  currentKey.current = key;

  // Justo después de cambiar un filtro, el hook aún tiene la página de la consulta anterior un render.
  const base = tagged.status === "ready" && tagged.data.key === key ? tagged.data.page : null;
  const { retry, refresh, liveness } = tagged;
  const meta = { retry, refresh, liveness };
  const first: AsyncState<ChangePage> & AsyncResult =
    tagged.status !== "ready"
      ? { ...tagged }
      : base
        ? { status: "ready", data: base, ...meta }
        : { status: "loading", ...meta };
  const active = more?.key === key ? more : null;
  let items: Change[] = [];
  if (base) {
    const previous = shown.current.key === key ? shown.current.items : [];
    items = mergeUnique(mergeUnique(base.items, previous), active?.items ?? []);
    shown.current = { key, items };
  }
  const cursor = base ? (active ? active.cursor : base.nextCursor) : null;
  const anyWaiting = items.some((c) => isWaiting(c.reviewStatus));
  useEffect(() => {
    if (base) setReviewing(anyWaiting);
  }, [base, anyWaiting]);

  async function loadMore() {
    if (!base || !cursor) return;
    const previous = active?.items ?? [];
    setMore({ key, items: previous, cursor, state: "loading" });
    try {
      const page = await source.changes(slug, {
        kind,
        status: statusesFor(state),
        q: q || undefined,
        cursor,
      });
      if (currentKey.current !== key) return;
      setMore({
        key,
        items: mergeUnique(previous, page.items),
        cursor: page.nextCursor,
        state: "idle",
      });
    } catch {
      if (currentKey.current !== key) return;
      setMore({ key, items: previous, cursor, state: "error" });
    }
  }

  return { first, items, hasMore: cursor !== null, moreState: active?.state ?? "idle", loadMore };
}
