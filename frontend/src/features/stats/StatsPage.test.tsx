// The statistics page mounted inside the whole app, over a fake data source.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { agentStats } from "../../data/mock";
import type { AgentStat } from "../../data/types";
import { ApiError, type DataSource } from "../../lib/api";
import { renderApp } from "../../test/render";

const NOW = new Date("2026-10-09T12:00:00Z");

/** The agents the redesign tests were written against: generic names, not Claude and Codex. */
const AGENTS = {
  health: async () => ({
    status: "ok" as const,
    dependencies: [],
    agentNames: ["agent_1", "agent_2"],
  }),
};

const renderWith = (source: Partial<DataSource>, path: string) => renderApp(path, source);

const renderWithNow = (source: Partial<DataSource>, path: string) =>
  renderApp(path, source, { now: NOW });

const renderWithAgents = (source: Partial<DataSource>, path: string) =>
  renderApp(path, { ...AGENTS, ...source }, { now: NOW });

afterEach(() => vi.restoreAllMocks());

describe("sortable stats", () => {
  function bodyAgents() {
    return screen
      .getAllByRole("row")
      .slice(1)
      .map((row) => within(row).getByRole("rowheader").textContent);
  }

  it("sorts by a column, flips the direction and reports it with aria-sort", async () => {
    renderWithNow({ agentStats: async () => agentStats }, "/stats");
    const header = await screen.findByRole("columnheader", { name: "Fallos" });
    expect(header).not.toHaveAttribute("aria-sort");
    expect(bodyAgents()).toEqual(["Claude", "Codex"]);

    await userEvent.click(within(header).getByRole("button", { name: "Fallos" }));
    expect(header).toHaveAttribute("aria-sort", "ascending");
    expect(bodyAgents()).toEqual(["Claude", "Codex"]);

    await userEvent.click(within(header).getByRole("button", { name: "Fallos" }));
    expect(header).toHaveAttribute("aria-sort", "descending");
    expect(bodyAgents()).toEqual(["Codex", "Claude"]);
  });

  it("moves aria-sort to the newly chosen column", async () => {
    renderWithNow({ agentStats: async () => agentStats }, "/stats");
    const failures = await screen.findByRole("columnheader", { name: "Fallos" });
    const duration = screen.getByRole("columnheader", { name: "Duración media" });
    await userEvent.click(within(failures).getByRole("button"));
    await userEvent.click(within(duration).getByRole("button"));
    expect(failures).not.toHaveAttribute("aria-sort");
    expect(duration).toHaveAttribute("aria-sort", "ascending");
    expect(bodyAgents()).toEqual(["Codex", "Claude"]);
  });
});

describe("real stats", () => {
  const stat = (overrides: Partial<AgentStat>): AgentStat => ({
    agent: "claude",
    total: 4,
    completed: 3,
    failed: 1,
    avgDurationMs: 2500,
    avgScore: 7.5,
    ...overrides,
  });

  it("shows a loading state and then one row per agent with formatted values", async () => {
    renderWith(
      { agentStats: async () => [stat({}), stat({ agent: "codex", total: 9 })] },
      "/stats",
    );
    expect(screen.getByText("Cargando estadísticas…")).toBeInTheDocument();
    const row = await screen.findByRole("row", { name: /Claude/ });
    expect(row).toHaveTextContent("2,5 s");
    expect(row).toHaveTextContent("7,5");
    expect(screen.getByRole("row", { name: /Codex/ })).toHaveTextContent("9");
  });

  it("shows the empty state", async () => {
    renderWith({ agentStats: async () => [] }, "/stats");
    expect(await screen.findByText("Aún no hay reviews registradas.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows a recoverable error", async () => {
    const agentStats = vi
      .fn<DataSource["agentStats"]>()
      .mockRejectedValueOnce(new ApiError("El servidor respondió 503.", 503))
      .mockResolvedValue([stat({})]);
    renderWith({ agentStats }, "/stats");
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("row", { name: /Claude/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a dash for missing averages and sorts them last in both directions", async () => {
    renderWith(
      {
        agentStats: async () => [
          stat({ agent: "codex", avgScore: null, avgDurationMs: null }),
          stat({ agent: "claude", avgScore: 6 }),
        ],
      },
      "/stats",
    );
    const nobody = await screen.findByRole("row", { name: /Codex/ });
    expect(within(nobody).getAllByText("—")).toHaveLength(2);
    const agents = () =>
      screen
        .getAllByRole("row")
        .slice(1)
        .map((row) => within(row).getByRole("rowheader").textContent);
    const header = screen.getByRole("columnheader", { name: "Nota media" });
    await userEvent.click(within(header).getByRole("button"));
    expect(agents()).toEqual(["Claude", "Codex"]);
    await userEvent.click(within(header).getByRole("button"));
    expect(agents()).toEqual(["Claude", "Codex"]);
  });
});

describe("statistics cards", () => {
  it("sums the agents and weights the averages by how many reviews each has", async () => {
    renderWithAgents(
      {
        agentStats: async () => [
          { agent: "agent_1", total: 3, completed: 3, failed: 0, avgDurationMs: 1000, avgScore: 9 },
          { agent: "agent_2", total: 1, completed: 0, failed: 1, avgDurationMs: 5000, avgScore: 5 },
        ],
      },
      "/stats",
    );
    await waitFor(() => expect(document.querySelector(".stat-cards")).not.toBeNull());
    const region = document.querySelector(".stat-cards") as HTMLElement;
    expect(region).toHaveAttribute("aria-label", "Resumen global");
    const card = (label: string) =>
      within(region).getByText(label).closest(".stat-card") as HTMLElement;
    expect(card("Reviews totales")).toHaveTextContent("4");
    expect(card("Completadas")).toHaveTextContent("3");
    expect(card("Con fallo")).toHaveTextContent("1");
    // (1000*3 + 5000*1) / 4 = 2000 ms; (9*3 + 5*1) / 4 = 8
    expect(card("Duración media")).toHaveTextContent("2 s");
    expect(card("Nota media")).toHaveTextContent("8");
  });

  it("shows a dash instead of an average nobody reported", async () => {
    renderWithAgents(
      {
        agentStats: async () => [
          {
            agent: "agent_1",
            total: 2,
            completed: 0,
            failed: 2,
            avgDurationMs: null,
            avgScore: null,
          },
        ],
      },
      "/stats",
    );
    await waitFor(() => expect(document.querySelector(".stat-cards")).not.toBeNull());
    const region = document.querySelector(".stat-cards") as HTMLElement;
    expect(within(region).getByText("Duración media").closest(".stat-card")).toHaveTextContent("—");
    expect(within(region).getByText("Nota media").closest(".stat-card")).toHaveTextContent("—");
  });
});
