/** Una tecla de atajo, decorativa: el control al que acompaña ya tiene su nombre. */
export function Kbd({ children }: { children: string }) {
  return (
    <span className="kbd" aria-hidden="true">
      {children}
    </span>
  );
}
