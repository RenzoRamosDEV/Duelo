interface Option<V extends string> {
  value: V;
  label: string;
  /** Contador a la derecha de la etiqueta («En curso 1»). */
  count?: number;
  /** Punto rojo: hay fallos detrás de esta opción. */
  alert?: boolean;
}

interface Props<V extends string> {
  /** Nombre accesible del grupo. */
  label: string;
  options: readonly Option<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** Control segmentado: botones con el elegido en `aria-pressed`, opcionalmente con contador. */
export function Segmented<V extends string>({ label, options, value, onChange }: Props<V>) {
  return (
    <fieldset className="segmented">
      <legend className="visually-hidden">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented-option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.alert && <span className="segmented-dot" aria-hidden="true" />}
          {option.label}
          {option.count !== undefined && <span className="segmented-count">{option.count}</span>}
        </button>
      ))}
    </fieldset>
  );
}
