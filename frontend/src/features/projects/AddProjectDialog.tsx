import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Busy } from "../../components/Busy";
import { Modal } from "../../components/Modal";
import { TokenField } from "../../components/TokenField";
import { Button } from "../../components/ui/Button";
import { useDataSource } from "../../data/source";
import { ApiError, type ProjectRef } from "../../lib/api";
import { apiErrorMessage } from "../../lib/apiErrorMessage";
import type { FormError } from "../../lib/formError";
import { clearIngestToken, useIngestToken } from "../../lib/ingestToken";
import { isAbsolutePath } from "../../lib/localPath";

interface Props {
  onClose: () => void;
  onAdded: (project: ProjectRef) => void;
}

const ADD_FAILURES = {
  404: "Esta función está desactivada en la API: arranca con LOCAL_PROJECTS_ENABLED=true.",
  409: "Este proyecto ya está añadido.",
  422: "La ruta no es un repositorio git válido. Comprueba que existe y que contiene una carpeta .git.",
} as const;

type Field = "path" | "token";

function failedField(error: unknown): Field | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 401) return "token";
  if (error.status === 409 || error.status === 422) return "path";
  return null;
}

/** Asks for the absolute path of a local git repository and registers it through the API. */
export function AddProjectDialog({ onClose, onAdded }: Props) {
  const source = useDataSource();
  const [token] = useIngestToken();
  const [path, setPath] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FormError<Field> | null>(null);
  const pathId = useId();
  const tokenId = useId();
  const hintId = useId();
  const errorId = useId();
  const pathRef = useRef<HTMLInputElement>(null);
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error?.field === "path") pathRef.current?.focus();
    if (error?.field === "token") tokenRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    const value = path.trim();
    if (!isAbsolutePath(value)) {
      setError({
        text: "Escribe la ruta absoluta del repositorio (empieza por / o por una unidad como C:\\).",
        field: "path",
      });
      return;
    }
    if (!token.trim()) {
      setError({ text: "Introduce el token de ingesta.", field: "token" });
      return;
    }
    setSending(true);
    setError(null);
    try {
      onAdded(await source.addProject(value, token.trim()));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) clearIngestToken();
      setError({
        text: apiErrorMessage(e, ADD_FAILURES, "añadir el proyecto"),
        field: failedField(e),
      });
      setSending(false);
    }
  }

  return (
    <Modal title="Añadir proyecto" onClose={onClose} dismissible={!sending}>
      <form className="modal-form" onSubmit={submit}>
        <p className="muted" id={hintId}>
          Al añadirlo, Duelo instalará dos hooks de git en ese repositorio (<code>post-commit</code>{" "}
          y <code>pre-push</code>) para recibir cada commit y push. Se desinstalan quitando el
          proyecto en Ajustes.
        </p>
        <label htmlFor={pathId}>Ruta del repositorio</label>
        <input
          id={pathId}
          className="search"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="/home/usuario/proyectos/mi-repo"
          ref={pathRef}
          aria-invalid={error?.field === "path" ? true : undefined}
          aria-describedby={error?.field === "path" ? `${hintId} ${errorId}` : hintId}
          data-autofocus
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <TokenField
          id={tokenId}
          ref={tokenRef}
          errorId={error?.field === "token" ? errorId : undefined}
        />
        {error && (
          <p className="notice" role="alert" id={errorId}>
            {error.text}
          </p>
        )}
        <div className="modal-actions">
          <Button onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={sending}>
            {sending ? <Busy activity="connect" label="Añadiendo…" inline /> : "Añadir"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
