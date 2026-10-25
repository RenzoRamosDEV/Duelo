import type { ReactNode } from "react";

export type Tone = "neutral" | "ok" | "warn" | "err" | "info";

/** Chip corto: neutro, de estado (ok/warn/err/info) y con contador opcional. */
export function Badge({
  tone = "neutral",
  count,
  title,
  children,
}: {
  tone?: Tone;
  count?: number;
  title?: string;
  children: ReactNode;
}) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {children}
      {count !== undefined && <span className="badge-count">{count}</span>}
    </span>
  );
}
