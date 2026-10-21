import { describe, expect, it, vi } from "vitest";
import { createLiveness, updatedAgo } from "./liveness";

describe("updatedAgo", () => {
  it.each([
    [0, "Actualizado ahora"],
    [4.9, "Actualizado ahora"],
    [5, "Actualizado hace 5 s"],
    [59.9, "Actualizado hace 59 s"],
    [60, "Actualizado hace 1 min"],
    [3599, "Actualizado hace 59 min"],
    [3600, "Actualizado hace 1 h"],
    [7300, "Actualizado hace 2 h"],
  ])("%s s → %s", (seconds, text) => expect(updatedAgo(seconds)).toBe(text));
});

describe("createLiveness", () => {
  it("starts with no update and no failure", () => {
    expect(createLiveness().get()).toEqual({ updatedAt: null, refreshFailed: false });
  });

  it("notifies subscribers only when something changes", () => {
    const liveness = createLiveness();
    const listener = vi.fn();
    liveness.subscribe(listener);
    liveness.set({ updatedAt: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(liveness.get()).toEqual({ updatedAt: 1, refreshFailed: false });
    liveness.set({ updatedAt: 1, refreshFailed: false });
    expect(listener).toHaveBeenCalledTimes(1);
    liveness.set({ refreshFailed: true });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(liveness.get()).toEqual({ updatedAt: 1, refreshFailed: true });
  });

  it("keeps the same snapshot while nothing changes", () => {
    const liveness = createLiveness();
    const before = liveness.get();
    liveness.set({ updatedAt: null });
    expect(liveness.get()).toBe(before);
  });

  it("stops notifying after unsubscribing", () => {
    const liveness = createLiveness();
    const listener = vi.fn();
    const unsubscribe = liveness.subscribe(listener);
    unsubscribe();
    liveness.set({ updatedAt: 2 });
    expect(listener).not.toHaveBeenCalled();
  });
});
