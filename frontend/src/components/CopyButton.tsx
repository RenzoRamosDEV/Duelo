import { useEffect, useState } from "react";
import { copyText } from "../utils/clipboard";
import { Button } from "./ui/Button";

type Result = "idle" | "ok" | "fail";

const MESSAGE: Record<Result, string> = { idle: "", ok: "Copiado", fail: "No se pudo copiar" };

/** Botón de copiar al portapapeles; el resultado se anuncia como texto en una región de estado. */
export function CopyButton({
  label,
  value,
  size = "md",
}: {
  label: string;
  value: string;
  size?: "md" | "sm";
}) {
  const [result, setResult] = useState<Result>("idle");

  useEffect(() => {
    if (result === "idle") return;
    const timer = setTimeout(() => setResult("idle"), 2500);
    return () => clearTimeout(timer);
  }, [result]);

  return (
    <span className="copy">
      <Button size={size} onClick={async () => setResult((await copyText(value)) ? "ok" : "fail")}>
        {label}
      </Button>
      <output className="copy-result">{MESSAGE[result]}</output>
    </span>
  );
}
