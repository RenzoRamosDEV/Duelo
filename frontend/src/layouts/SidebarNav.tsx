import { NavLink } from "react-router";

type Props = {
  /** Se llama al pulsar un enlace; el cajón móvil lo usa para cerrarse. */
  onNavigate?: () => void;
};

const LINKS = [
  { to: "/", label: "Proyectos", end: true },
  { to: "/stats", label: "Estadísticas", end: false },
  { to: "/settings", label: "Ajustes", end: false },
];

export function SidebarNav({ onNavigate }: Props) {
  return (
    <nav className="nav" aria-label="Principal">
      <ul className="nav-group">
        {LINKS.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end} className="nav-link" onClick={onNavigate}>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
