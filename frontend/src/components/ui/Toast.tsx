import { useEffect } from "react";
import type { Tone } from "./Badge";
import { Button } from "./Button";

const AUTO_CLOSE_MS = 6000;

interface Props {
  tone?: Exclude<Tone, "neutral" | "info">;
  message: string;
  onClose: () => void;
}

/** Resultado de una acción, abajo a la derecha; se anuncia como estado y se cierra solo. */
export function Toast({ tone = "ok", message, onClose }: Props) {
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <output className={`toast toast-${tone}`}>
      <p>{message}</p>
      <Button variant="ghost" size="sm" onClick={onClose} aria-label="Cerrar aviso">
        ✕
      </Button>
    </output>
  );
}
