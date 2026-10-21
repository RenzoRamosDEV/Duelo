import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type LivenessSnapshot, createLiveness } from "../lib/liveness";
import { PollingProvider } from "../lib/polling";
import { UpdatedAgo } from "./UpdatedAgo";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const at = (secondsAgo: number) => Date.now() - secondsAgo * 1000;

function livenessWith(snapshot: Partial<LivenessSnapshot>) {
  const liveness = createLiveness();
  liveness.set(snapshot);
  return liveness;
}

describe("UpdatedAgo", () => {
  it("shows how long ago the data was loaded and keeps counting", () => {
    render(
      <PollingProvider intervalMs={5000}>
        <UpdatedAgo liveness={livenessWith({ updatedAt: at(30) })} />
      </PollingProvider>,
    );
    expect(screen.getByText("Actualizado hace 30 s")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(35_000);
    });
    expect(screen.getByText("Actualizado hace 1 min")).toBeInTheDocument();
  });

  it("announces a failed refresh once, in a status region, and keeps the age out of it", () => {
    render(
      <PollingProvider intervalMs={5000}>
        <UpdatedAgo liveness={livenessWith({ updatedAt: at(10), refreshFailed: true })} />
      </PollingProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo actualizar");
    expect(screen.getByRole("status")).not.toHaveTextContent("Actualizado hace");
  });

  it("renders nothing before the first load or when polling is off", () => {
    const { container, rerender } = render(
      <PollingProvider intervalMs={5000}>
        <UpdatedAgo liveness={createLiveness()} />
      </PollingProvider>,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<UpdatedAgo liveness={livenessWith({ updatedAt: at(30) })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("does not tick while the tab is hidden", () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    render(
      <PollingProvider intervalMs={5000}>
        <UpdatedAgo liveness={livenessWith({ updatedAt: at(10) })} />
      </PollingProvider>,
    );
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText("Actualizado hace 10 s")).toBeInTheDocument();
  });

  it("follows the store on its own, without its parent re-rendering", () => {
    const liveness = livenessWith({ updatedAt: at(30) });
    let parentRenders = 0;
    function Parent() {
      parentRenders += 1;
      return <UpdatedAgo liveness={liveness} />;
    }
    render(
      <PollingProvider intervalMs={5000}>
        <Parent />
      </PollingProvider>,
    );
    act(() => liveness.set({ updatedAt: Date.now(), refreshFailed: true }));
    expect(screen.getByText("Actualizado ahora")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("No se pudo actualizar");
    expect(parentRenders).toBe(1);
  });
});
