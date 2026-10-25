import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { clearIngestToken, useIngestToken } from "../hooks/useIngestToken";
import { ApiError } from "../services/apiError";
import { apiErrorMessage } from "../services/errorMessage";
import { useDataSource } from "../services/source";
import type { FormError, ProjectRef } from "../types";
import { isAbsolutePath } from "../utils/localPath";
import { TokenField } from "./TokenField";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { Modal } from "./ui/Modal";
import { Notice } from "./ui/Notice";

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

/** Pide la ruta absoluta de un repositorio git local y lo da de alta en la API. */
export function AddProjectDialog({ onClose, onAdded }: Props) {
  const source = useDataSource();
  const [token] = useIngestToken();
  const [path, setPath] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FormError<Field> | null>(null);
  const pathId = useId();
  const tokenId = useId();
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
      <form className="modal-body" onSubmit={submit}>
        <p className="text-secondary">
          Al añadirlo, Duelo instalará dos hooks de git en ese repositorio (<code>post-commit</code>{" "}
          y <code>pre-push</code>) para recibir cada commit y push. Se desinstalan quitando el
          proyecto en Ajustes.
        </p>
        <Input
          id={pathId}
          ref={pathRef}
          label="Ruta del repositorio"
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="/home/usuario/proyectos/mi-repo"
          data-autofocus
          error={error?.field === "path" ? error.text : undefined}
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <TokenField
          id={tokenId}
          ref={tokenRef}
          error={error?.field === "token" ? error.text : undefined}
        />
        {error && error.field === null && (
          <Notice tone="alert" role="alert">
            <p>{error.text}</p>
          </Notice>
        )}
        <div className="modal-actions">
          <Button onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" busy={sending && "Añadiendo…"}>
            Añadir
          </Button>
        </div>
      </form>
    </Modal>
  );
}
