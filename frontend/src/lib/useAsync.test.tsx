import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAsync } from "./useAsync";

const flush = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function setVisibility(state: "visible" | "hidden") {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAsync polling", () => {
  it("refreshes in the background without going back to loading", async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    const statuses: string[] = [];
    const { result } = renderHook(() => {
      const r = useAsync(load, { pollMs: 1000 });
      statuses.push(r.status);
      return r;
    });
    await flush(0);
    expect(result.current).toMatchObject({ status: "ready", data: 1 });

    await flush(1000);
    expect(result.current).toMatchObject({ status: "ready", data: 2 });
    await flush(1000);
    expect(result.current).toMatchObject({ status: "ready", data: 3 });
    // After the first load every render stays "ready": the refreshes never flash a loading state.
    expect(statuses.slice(statuses.indexOf("ready")).every((s) => s === "ready")).toBe(true);
  });

  it("does not poll without a period", async () => {
    const load = vi.fn(async () => 1);
    renderHook(() => useAsync(load));
    await flush(60_000);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps the same object when the refreshed value is equal", async () => {
    const load = vi.fn(async () => ({ items: [1, 2] }));
    const { result } = renderHook(() =>
      useAsync(load, { pollMs: 1000, equals: (a, b) => a.items.join() === b.items.join() }),
    );
    await flush(0);
    const first = result.current.status === "ready" ? result.current.data : null;
    await flush(3000);
    expect(load).toHaveBeenCalledTimes(4);
    expect(result.current.status === "ready" && result.current.data).toBe(first);
  });

  it("does not start a request while the previous one is still running", async () => {
    const pending = deferred<number>();
    const load = vi.fn().mockResolvedValueOnce(1).mockReturnValue(pending.promise);
    renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(0);
    await flush(5000);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("pauses while the tab is hidden and refreshes as soon as it is shown", async () => {
    const load = vi.fn(async () => 1);
    renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(0);
    setVisibility("hidden");
    await flush(10_000);
    expect(load).toHaveBeenCalledTimes(1);

    setVisibility("visible");
    await flush(0);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("stops polling once pollWhile says the data is final", async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    const { result } = renderHook(() => useAsync(load, { pollMs: 1000, pollWhile: (d) => d < 3 }));
    await flush(0);
    for (let i = 0; i < 10; i++) await flush(1000);
    expect(result.current).toMatchObject({ status: "ready", data: 3 });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("ignores a background response that belongs to a previous load", async () => {
    const late = deferred<string>();
    const loadA = vi.fn().mockResolvedValueOnce("a1").mockReturnValue(late.promise);
    const loadB = vi.fn(async () => "b1");
    const { result, rerender } = renderHook(({ load }) => useAsync(load, { pollMs: 1000 }), {
      initialProps: { load: loadA as () => Promise<string> },
    });
    await flush(0);
    await flush(1000);
    expect(loadA).toHaveBeenCalledTimes(2);

    rerender({ load: loadB });
    await flush(0);
    expect(result.current).toMatchObject({ status: "ready", data: "b1" });

    late.resolve("a2");
    await flush(0);
    expect(result.current).toMatchObject({ status: "ready", data: "b1" });
  });

  it("keeps the data and flags the failure when a refresh fails, then recovers", async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("down"))
      .mockResolvedValue("again");
    const { result } = renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(0);
    await flush(1000);
    expect(result.current).toMatchObject({ status: "ready", data: "ok" });
    expect(result.current.liveness.get().refreshFailed).toBe(true);

    await flush(1000);
    expect(result.current).toMatchObject({ status: "ready", data: "again" });
    expect(result.current.liveness.get().refreshFailed).toBe(false);
  });

  it("refresh() reloads silently even without polling", async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    const { result } = renderHook(() => useAsync(load));
    await flush(0);
    act(() => result.current.refresh());
    await flush(0);
    expect(result.current).toMatchObject({ status: "ready", data: 2 });
  });

  it("does not leave the error state on its own", async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue("ok");
    const { result } = renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(5000);
    expect(result.current.status).toBe("error");
    expect(load).toHaveBeenCalledTimes(1);
    act(() => result.current.retry());
    await flush(0);
    expect(result.current).toMatchObject({ status: "ready", data: "ok" });
  });
});

/** A load that never settles on its own and rejects with the abort reason, like `fetch`. */
function hangingLoad() {
  const signals: AbortSignal[] = [];
  const load = vi.fn(
    (signal: AbortSignal) =>
      new Promise<string>((_resolve, reject) => {
        signals.push(signal);
        signal.addEventListener("abort", () => reject(signal.reason));
      }),
  );
  return { load, signals };
}

describe("useAsync cancellation", () => {
  it("aborts the load in progress on unmount", async () => {
    const { load, signals } = hangingLoad();
    const { unmount } = renderHook(() => useAsync(load));
    await flush(0);
    expect(signals[0].aborted).toBe(false);
    unmount();
    expect(signals[0].aborted).toBe(true);
  });

  it("aborts the previous load when `load` changes and keeps the new result", async () => {
    const { load: first, signals } = hangingLoad();
    const second = vi.fn(async (_signal: AbortSignal) => "b");
    const { result, rerender } = renderHook(({ load }) => useAsync(load), {
      initialProps: { load: first as (signal: AbortSignal) => Promise<string> },
    });
    await flush(0);
    rerender({ load: second });
    await flush(0);
    expect(signals[0].aborted).toBe(true);
    expect(result.current).toMatchObject({ status: "ready", data: "b" });
  });

  it("does not flag a refresh aborted by unmounting as failed", async () => {
    const pending = hangingLoad();
    const load = vi.fn((signal: AbortSignal) => pending.load(signal)).mockResolvedValueOnce("ok");
    const { result, unmount } = renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(0);
    await flush(1000);
    const before = result.current;
    unmount();
    await flush(0);
    expect(pending.signals[0].aborted).toBe(true);
    expect(before).toMatchObject({ status: "ready", data: "ok" });
    expect(result.current).toBe(before);
  });

  it("flags a refresh that times out and tries again on the next poll", async () => {
    const timeout = new Error("El servidor no respondió a tiempo.");
    const load = vi
      .fn((_signal: AbortSignal) => Promise.resolve("ok"))
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(timeout);
    const { result } = renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(0);
    await flush(1000);
    expect(result.current).toMatchObject({ status: "ready", data: "ok" });
    expect(result.current.liveness.get().refreshFailed).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
    expect(load.mock.calls[1][0]).toBeInstanceOf(AbortSignal);
    await flush(1000);
    expect(load).toHaveBeenCalledTimes(3);
  });
});

describe("useAsync liveness", () => {
  const sameItems = (a: { items: number[] }, b: { items: number[] }) =>
    a.items.join() === b.items.join();

  function renderCounted<T>(load: () => Promise<T>, options: Parameters<typeof useAsync<T>>[1]) {
    let renders = 0;
    const hook = renderHook(() => {
      renders += 1;
      return useAsync(load, options);
    });
    return { ...hook, renders: () => renders };
  }

  it("advances the update time without re-rendering when the refresh is equal", async () => {
    vi.setSystemTime(1_000);
    const load = vi.fn(async () => ({ items: [1] }));
    const { result, renders } = renderCounted(load, { pollMs: 1000, equals: sameItems });
    await flush(0);
    const shown = renders();
    const firstUpdate = result.current.liveness.get().updatedAt;
    expect(firstUpdate).toBe(1_000);

    await flush(1000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(renders()).toBe(shown);
    expect(result.current.liveness.get().updatedAt).toBe(2_000);
  });

  it("re-renders when the refresh brings different data", async () => {
    let n = 0;
    const load = vi.fn(async () => ({ items: [++n] }));
    const { result, renders } = renderCounted(load, { pollMs: 1000, equals: sameItems });
    await flush(0);
    const shown = renders();
    await flush(1000);
    expect(renders()).toBeGreaterThan(shown);
    expect(result.current).toMatchObject({ data: { items: [2] } });
  });

  it("flags and clears a failed refresh in the store without re-rendering equal data", async () => {
    const load = vi
      .fn(async () => ({ items: [1] }))
      .mockResolvedValueOnce({ items: [1] })
      .mockRejectedValueOnce(new Error("down"));
    const { result, renders } = renderCounted(load, { pollMs: 1000, equals: sameItems });
    await flush(0);
    const shown = renders();
    await flush(1000);
    expect(result.current.liveness.get().refreshFailed).toBe(true);
    await flush(1000);
    expect(result.current.liveness.get().refreshFailed).toBe(false);
    expect(renders()).toBe(shown);
  });

  it("keeps the same store across renders and resets it on retry", async () => {
    const load = vi
      .fn(async () => "ok")
      .mockResolvedValueOnce("ok")
      .mockRejectedValueOnce(new Error("down"));
    const { result } = renderHook(() => useAsync(load, { pollMs: 1000 }));
    await flush(0);
    const liveness = result.current.liveness;
    await flush(1000);
    expect(result.current.liveness).toBe(liveness);
    expect(liveness.get().refreshFailed).toBe(true);

    act(() => result.current.retry());
    expect(liveness.get()).toEqual({ updatedAt: null, refreshFailed: false });
    await flush(0);
    expect(liveness.get().updatedAt).not.toBeNull();
  });
});
