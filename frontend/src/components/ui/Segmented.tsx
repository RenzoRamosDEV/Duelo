interface Option<V extends string> {
  value: V;
  label: string;
}

interface Props<V extends string> {
  /** Nombre accesible del grupo. */
  label: string;
  options: readonly Option<V>[];
  value: V;
  onChange: (value: V) => void;
}

/** Control segmentado: un grupo de botones con el elegido en `aria-pressed`. */
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
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
