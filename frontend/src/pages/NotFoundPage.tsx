import { Link } from "react-router";
import { EmptyState } from "../components/ui/EmptyState";

export default function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        heading="h1"
        title="No encontrado"
        description="Esta dirección no corresponde a ninguna página."
        action={
          <Link className="button button-secondary" to="/">
            Volver al inicio
          </Link>
        }
      />
    </div>
  );
}
