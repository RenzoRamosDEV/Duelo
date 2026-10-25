import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <section className="page">
      <h1 className="prompt cursor">No encontrado</h1>
      <p>Esta dirección no corresponde a ninguna página.</p>
      <p>
        <Link to="/">Volver al inicio</Link>
      </p>
    </section>
  );
}
