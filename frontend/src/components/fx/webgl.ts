/** Answers cached per WebGL version: creating a context is not free and the answer never changes. */
const cached = new Map<1 | 2, boolean>();

/** `true` when a WebGL context can be created here (never in jsdom, rarely in locked-down browsers). */
export function hasWebGL(version: 1 | 2 = 1): boolean {
  const known = cached.get(version);
  if (known !== undefined) return known;
  const gl = probe(version);
  // Browsers cap live WebGL contexts; the probe gives its slot back to the real effects.
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  cached.set(version, gl !== null);
  return gl !== null;
}

function probe(version: 1 | 2): WebGLRenderingContext | WebGL2RenderingContext | null {
  try {
    const canvas = document.createElement("canvas");
    return version === 2
      ? canvas.getContext("webgl2")
      : (canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return null;
  }
}

/** Test hook: forget the cached answers. */
export function resetWebGLForTests(): void {
  cached.clear();
}
