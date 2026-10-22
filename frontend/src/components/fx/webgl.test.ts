import { afterEach, describe, expect, it, vi } from "vitest";
import { hasWebGL, resetWebGLForTests } from "./webgl";

/** A canvas whose `getContext` hands out a fake context, with or without `WEBGL_lose_context`. */
function fakeContext(withLoseContext: boolean) {
  const loseContext = vi.fn();
  const context = {
    getExtension: vi.fn((name: string) =>
      withLoseContext && name === "WEBGL_lose_context" ? { loseContext } : null,
    ),
  };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    context as unknown as RenderingContext,
  );
  return { context, loseContext };
}

afterEach(() => {
  resetWebGLForTests();
  vi.restoreAllMocks();
});

describe("hasWebGL", () => {
  it("frees its probe context once and keeps the answer cached", () => {
    const { loseContext } = fakeContext(true);
    expect(hasWebGL()).toBe(true);
    expect(hasWebGL()).toBe(true);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it("still answers when the extension is missing", () => {
    const { context } = fakeContext(false);
    expect(hasWebGL(2)).toBe(true);
    expect(context.getExtension).toHaveBeenCalledWith("WEBGL_lose_context");
  });
});
