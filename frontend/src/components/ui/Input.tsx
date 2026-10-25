import { type InputHTMLAttributes, type Ref, useId } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: string;
  hint?: string;
  /** Mensaje de error de este campo; lo marca inválido y lo enlaza por `aria-describedby`. */
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de formulario con etiqueta, pista y error enlazados. */
export function Input({ id, label, hint, error, ref, className, ...rest }: Props) {
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        ref={ref}
        id={id}
        className={className ? `input ${className}` : "input"}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
