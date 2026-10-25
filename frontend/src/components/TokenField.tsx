import type { Ref } from "react";
import { useIngestToken } from "../hooks/useIngestToken";
import { Input } from "./ui/Input";

interface Props {
  id: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

/** El campo del token de ingesta, compartido por todos los formularios que llaman a un endpoint protegido. */
export function TokenField({ id, error, ref }: Props) {
  const [token, setToken] = useIngestToken();
  return (
    <Input
      ref={ref}
      id={id}
      label="Token de ingesta"
      type="password"
      autoComplete="off"
      error={error}
      value={token}
      onChange={(e) => setToken(e.target.value)}
    />
  );
}
