import { useNow } from "../hooks/useNow";
import { absoluteTime, relativeTime } from "../utils/relativeTime";

/** «hace 12 min» con la fecha completa en el `title`; nada si la fecha no vale. */
export function Age({ iso }: { iso: string | undefined }) {
  const now = useNow();
  const text = iso ? relativeTime(iso, now) : null;
  if (!iso || !text) return null;
  return (
    <time dateTime={iso} title={absoluteTime(iso)}>
      {text}
    </time>
  );
}
