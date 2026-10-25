import type { ReactNode } from "react";

export type NoticeTone = "ok" | "alert" | "info";

interface Props {
  tone?: NoticeTone;
  /** `alert` interrumpe al lector de pantalla; `status` espera. */
  role?: "alert" | "status";
  className?: string;
  children: ReactNode;
}

/** Mensaje en línea con borde de 1 px: resultado de una acción, aviso o error. */
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
