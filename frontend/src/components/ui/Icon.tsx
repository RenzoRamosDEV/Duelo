export type IconName =
  | "folder"
  | "chart"
  | "gear"
  | "plus"
  | "menu"
  | "close"
  | "external"
  | "search";

const PATHS: Record<IconName, string> = {
  folder: "M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H2",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3 1.8-1.4-2-3.4-2.1.9a7 7 0 0 0-1.7-1l-.3-2.3h-4l-.3 2.3a7 7 0 0 0-1.7 1l-2.1-.9-2 3.4L6.6 12l-1.8 1.4 2 3.4 2.1-.9a7 7 0 0 0 1.7 1l.3 2.3h4l.3-2.3a7 7 0 0 0 1.7-1l2.1.9 2-3.4z",
  plus: "M12 5v14M5 12h14",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  external: "M14 4h6v6m0-6L10 14M20 14v6H4V4h6",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3",
};

/** Icono de línea de 16 px, decorativo: el texto que lo acompaña da el nombre. */
export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  return (
    <svg
      className="icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
