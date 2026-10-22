import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { DataSource } from "../lib/api";
import { makeSource } from "../test/fixtures";
import { DataSourceProvider, useAgentNames } from "./source";

function Names() {
  const names = useAgentNames();
  return <output>{names === null ? "?" : names.join(",")}</output>;
}

const healthy = async () => ({ status: "ok" as const, dependencies: [], agentNames: ["claude"] });

function mount(source: DataSource, count = 1) {
  return render(
    <DataSourceProvider source={source}>
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: identical, static consumers
        <Names key={i} />
      ))}
    </DataSourceProvider>,
  );
}

describe("useAgentNames", () => {
  it("asks the source once for every component that needs the agents", async () => {
    const health = vi.fn(healthy);
    mount(makeSource({ health }), 3);
    await waitFor(() => expect(screen.getAllByText("claude")).toHaveLength(3));
    expect(health).toHaveBeenCalledTimes(1);
  });

  it("asks each source once", async () => {
    const first = vi.fn(healthy);
    const second = vi.fn(healthy);
    mount(makeSource({ health: first }));
    mount(makeSource({ health: second }));
    await waitFor(() => expect(screen.getAllByText("claude")).toHaveLength(2));
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("asks again on the next mount after a failure, and not after a success", async () => {
    const health = vi
      .fn<DataSource["health"]>()
      .mockRejectedValueOnce(new Error("down"))
      .mockImplementation(healthy);
    const source = makeSource({ health });

    const failed = mount(source);
    await waitFor(() => expect(health).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("?")).toBeInTheDocument();
    failed.unmount();

    const retried = mount(source);
    expect(await screen.findByText("claude")).toBeInTheDocument();
    expect(health).toHaveBeenCalledTimes(2);
    retried.unmount();

    mount(source);
    expect(await screen.findByText("claude")).toBeInTheDocument();
    expect(health).toHaveBeenCalledTimes(2);
  });
});
