import { Button } from "./Button";
import { Notice } from "./Notice";

/** Error recuperable: el mensaje y, si se puede, «Reintentar». */
export function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Notice tone="alert" role="alert">
      <p>{message}</p>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </Notice>
  );
}
