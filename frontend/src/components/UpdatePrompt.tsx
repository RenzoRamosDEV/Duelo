import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "./ui/Button";

/**
 * Avisa de que hay un build nuevo y deja recargar cuando el usuario quiera. El service worker
 * nunca recarga por su cuenta (`registerType: "prompt"`), así que una review no se corta a medias.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <output className="update-prompt">
      <p>Nueva versión disponible.</p>
      <Button variant="primary" size="sm" onClick={() => updateServiceWorker(true)}>
        Actualizar
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setNeedRefresh(false)}>
        Cerrar
      </Button>
    </output>
  );
}
