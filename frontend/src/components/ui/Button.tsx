import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader } from "./Loader";

type Variant = "default" | "primary" | "danger" | "ghost";
type Size = "md" | "sm";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  variant?: Variant;
  size?: Size;
  type?: "button" | "submit" | "reset";
  /** Etiqueta mientras la acción está en curso: deshabilita el botón y la muestra con el cursor. */
  busy?: string | false;
  children: ReactNode;
}

export function Button({
  variant = "default",
  size = "md",
  type = "button",
  busy = false,
  disabled,
  className,
  children,
  ...rest
}: Props) {
  const classes = ["button", `button-${variant}`, size === "sm" && "button-sm", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || Boolean(busy)}
      aria-busy={busy ? true : undefined}
      {...rest}
    >
      {busy ? <Loader label={busy} inline /> : children}
    </button>
  );
}
