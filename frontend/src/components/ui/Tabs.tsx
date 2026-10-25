import { type KeyboardEvent, type ReactNode, useRef } from "react";

export interface TabItem<V extends string> {
  value: V;
  label: string;
  count?: number;
}

interface TabsProps<V extends string> {
  label: string;
  tabs: readonly TabItem<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Prefijo de los ids que enlazan cada pestaña con su panel. */
  idPrefix: string;
}

/** Pestañas accesibles: `tablist` con flechas, Inicio y Fin; cada panel va en `TabPanel`. */
export function Tabs<V extends string>({ label, tabs, value, onChange, idPrefix }: TabsProps<V>) {
  const list = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((tab) => tab.value === value);
    const last = tabs.length - 1;
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : event.key === "ArrowLeft"
          ? (index - 1 + tabs.length) % tabs.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : -1;
    if (next === -1) return;
    event.preventDefault();
    const target = tabs[next];
    onChange(target.value);
    list.current?.querySelector<HTMLElement>(`#${idPrefix}-tab-${target.value}`)?.focus();
  }

  return (
    <div ref={list} className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.value}`}
            className="tab"
            aria-selected={selected}
            aria-controls={`${idPrefix}-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
          >
            {tab.label}
            {tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  idPrefix,
  value,
  children,
}: {
  idPrefix: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      className="tab-panel"
    >
      {children}
    </div>
  );
}
