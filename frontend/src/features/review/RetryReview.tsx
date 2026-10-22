import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { Busy } from "../../components/Busy";
import { TokenField } from "../../components/TokenField";
import { MetalButton } from "../../components/fx/MetalButton";
import { useDataSource } from "../../data/source";
import { ApiError } from "../../lib/api";
import { apiErrorMessage } from "../../lib/apiErrorMessage";
import type { FormError } from "../../lib/formError";
import { clearIngestToken, useIngestToken } from "../../lib/ingestToken";

interface Props {
  changeId: string;
  /** Called with a message to announce when the retry was accepted or is no longer possible. */
  onSettled: (message: string) => void;
}

const RETRY_FAILURES = {
  404: "Change no encontrado.",
  503: "El orquestador no está disponible. Inténtalo de nuevo en unos minutos.",
} as const;

/**
 * Retry form for a change whose review failed. The token is typed by the user and kept in memory
 * only (see `lib/ingestToken`); a 401 forgets it.
 */
export function RetryReview({ changeId, onSettled }: Props) {
  const source = useDataSource();
  const [token] = useIngestToken();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<FormError<"token"> | null>(null);
  const tokenId = useId();
  const errorId = useId();
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
        errorId={error?.field === "token" ? errorId : undefined}
      />
      <MetalButton type="submit" disabled={sending}>
        {sending ? <Busy activity="retry" label="Reintentando…" inline /> : "Reintentar review"}
      </MetalButton>
      {error && (
        <p className="notice" role="alert" id={errorId}>
          {error.text}
        </p>
      )}
    </form>
  );
}
