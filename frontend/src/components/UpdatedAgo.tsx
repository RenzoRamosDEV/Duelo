import { useEffect, useState, useSyncExternalStore } from "react";
import { type Liveness, updatedAgo } from "../utils/liveness";

/**
 * «Actualizado hace N s» discreto de una página viva. Lee el store de la página y avanza con su
 * propio temporizador (pausado con la pestaña oculta) para que la lista de alrededor no se
 * repinte; solo el aviso de fallo se anuncia, una vez.
 */
export function UpdatedAgo({ liveness }: { liveness: Liveness }) {
  const { updatedAt, refreshFailed } = useSyncExternalStore(liveness.subscribe, liveness.get);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "hidden") setNow(Date.now());
    };
    const timer = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  if (updatedAt === null) return null;
  return (
    <span className="updated">
      {refreshFailed && <output>No se pudo actualizar; se reintentará. </output>}
      <span>{updatedAgo(Math.max(0, (now - updatedAt) / 1000))}</span>
    </span>
  );
}
