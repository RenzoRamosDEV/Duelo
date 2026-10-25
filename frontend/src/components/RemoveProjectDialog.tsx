import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { clearIngestToken, useIngestToken } from "../hooks/useIngestToken";
import { ApiError } from "../services/apiError";
import { apiErrorMessage } from "../services/errorMessage";
import { useDataSource } from "../services/source";
import type { FormError, ProjectRef } from "../types";
import { TokenField } from "./TokenField";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { Notice } from "./ui/Notice";

const PROJECT_FAILURES = { 404: "El proyecto ya no existe." } as const;

/** Confirmación para quitar un proyecto: borra su historial en Duelo y desinstala sus hooks. */
export function RemoveProjectDialog({
  project,
  onClose,
  onRemoved,
}: {
  project: ProjectRef;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const source = useDataSource();
  const [token] = useIngestToken();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FormError<"token"> | null>(null);
  const tokenId = useId();
  const tokenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (error?.field === "token") tokenRef.current?.focus();
  }, [error]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (sending) return;
    if (!token.trim()) {
      setError({ text: "Introduce el token de ingesta.", field: "token" });
      return;
    }
    setSending(true);
    setError(null);
    try {
      await source.removeProject(project.slug, token.trim());
      onRemoved();
    } catch (e) {
      const rejected = e instanceof ApiError && e.status === 401;
      if (rejected) clearIngestToken();
      // 409: no se pudieron quitar los hooks y el proyecto se conserva. El servidor dice qué
      // revisar (permisos de .git/hooks), así que su mensaje se muestra tal cual.
      setError({
        text:
          e instanceof ApiError && e.status === 409
            ? `${e.message} El proyecto se conserva: puedes repetir la baja.`
            : apiErrorMessage(e, PROJECT_FAILURES, "quitar el proyecto"),
        field: rejected ? "token" : null,
      });
      setSending(false);
    }
  }

  return (
    <Modal title={`Quitar ${project.name}`} onClose={onClose} dismissible={!sending}>
      <form className="modal-body" onSubmit={submit}>
        <p>
          Se borrará <strong>todo el historial</strong> de este proyecto en Duelo (changes, reviews
          y eventos)
          {project.hooksInstalled ? " y se desinstalarán sus hooks de git" : ""}. Los archivos de tu
          repositorio no se tocan. Esta acción no se puede deshacer.
        </p>
        <TokenField
          id={tokenId}
          ref={tokenRef}
          error={error?.field === "token" ? error.text : undefined}
        />
        {error && error.field === null && (
          <Notice tone="err" role="alert">
            <p>{error.text}</p>
          </Notice>
        )}
        <div className="modal-actions">
          <Button onClick={onClose} disabled={sending} data-autofocus>
            Cancelar
          </Button>
          <Button type="submit" variant="danger" busy={sending && "Quitando…"}>
            Quitar proyecto
          </Button>
        </div>
      </form>
    </Modal>
  );
}
