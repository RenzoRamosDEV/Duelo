import type { ReactNode } from "react";
import type { Tone } from "./Badge";

interface Props {
  tone?: Exclude<Tone, "neutral">;
  /** `alert` interrumpe al lector de pantalla; `status` espera. */
  role?: "alert" | "status";
  className?: string;
  children: ReactNode;
}

/** Mensaje en línea con borde izquierdo semántico: resultado de una acción, aviso o error. */
export function Notice({ tone = "info", role = "status", className, children }: Props) {
  const classes = ["notice", `notice-${tone}`, className].filter(Boolean).join(" ");
  if (role === "alert") {
    return (
      <div className={classes} role="alert">
        {children}
      </div>
    );
  }
  return <output className={classes}>{children}</output>;
}
