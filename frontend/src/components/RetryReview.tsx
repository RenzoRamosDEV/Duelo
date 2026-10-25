import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { clearIngestToken, useIngestToken } from "../hooks/useIngestToken";
import { ApiError } from "../services/apiError";
import { apiErrorMessage } from "../services/errorMessage";
import { useDataSource } from "../services/source";
import type { FormError } from "../types";
import { TokenField } from "./TokenField";
import { Button } from "./ui/Button";
import { Notice } from "./ui/Notice";

interface Props {
  changeId: string;
  /** Recibe el mensaje a anunciar cuando el reintento se aceptó o ya no es posible. */
  onSettled: (message: string) => void;
}

const RETRY_FAILURES = {
  404: "Change no encontrado.",
  503: "El orquestador no está disponible. Inténtalo de nuevo en unos minutos.",
} as const;

/**
 * Formulario de reintento de un change cuya review falló. El token lo escribe el usuario y vive
 * solo en memoria; un 401 lo olvida.
 */
export function RetryReview({ changeId, onSettled }: Props) {
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
    const value = token.trim();
    if (!value) {
      setError({ text: "Introduce el token de ingesta para reintentar.", field: "token" });
      return;
    }
    setSending(true);
    setError(null);
    try {
      const result = await source.retry(changeId, value);
      onSettled(`Reintento en marcha (run ${result.run}).`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        onSettled("Esta review ya no se puede reintentar: su estado cambió.");
      } else {
        const rejected = e instanceof ApiError && e.status === 401;
        if (rejected) clearIngestToken();
        setError({
          text: apiErrorMessage(e, RETRY_FAILURES, "reintentar"),
          field: rejected ? "token" : null,
        });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="retry" onSubmit={submit}>
      <TokenField
        id={tokenId}
        ref={tokenRef}
        error={error?.field === "token" ? error.text : undefined}
      />
      <Button type="submit" variant="primary" busy={sending && "Reintentando…"}>
        Reintentar review
      </Button>
      {error && error.field === null && (
        <Notice tone="err" role="alert">
          <p>{error.text}</p>
        </Notice>
      )}
    </form>
  );
}
