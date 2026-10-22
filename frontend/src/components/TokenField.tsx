import type { Ref } from "react";
import { useIngestToken } from "../lib/ingestToken";

interface Props {
  id: string;
  /** Id of the error message about this field; marks the input invalid and described by it. */
  errorId?: string;
  ref?: Ref<HTMLInputElement>;
}

/** The ingest token input shared by every form that calls a protected endpoint. */
export function TokenField({ id, errorId, ref }: Props) {
  const [token, setToken] = useIngestToken();
  return (
    <>
      <label htmlFor={id}>Token de ingesta</label>
      <input
        ref={ref}
        id={id}
        className="search"
        type="password"
        autoComplete="off"
        aria-invalid={errorId ? true : undefined}
        aria-describedby={errorId}
        value={token}
        onChange={(e) => setToken(e.target.value)}
      />
    </>
  );
}
