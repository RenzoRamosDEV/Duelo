import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { DataSourceProvider } from "../data/source";
import { ApiError, type DataSource } from "../lib/api";
import { makeChange, makeFinding, makeReview, makeSource } from "../test/fixtures";

function renderWith(source: Partial<DataSource>, path: string) {
  return render(
    <DataSourceProvider source={makeSource(source)}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </DataSourceProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const health =
  (agentNames: string[]): DataSource["health"] =>
  async () => ({
    status: "ok",
    dependencies: [],
    agentNames,
  });

describe("configured agents", () => {
  // Origin: the UI said «Claude y Codex» and assumed two agents whatever the backend configured.
  const AGENTS = ["agent_1", "agent_2", "gemini"];

  it("names the real agents in the channel instead of Claude and Codex", async () => {
    renderWith({ health: health(AGENTS) }, "/p/demo");
    expect(
      await screen.findByText("Commits y PRs revisados por Agent_1, Agent_2 y Gemini."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Claude/)).toBeNull();
  });

  it("does not claim any agent while they are unknown", async () => {
    renderWith(
      {
        health: async () => {
          throw new ApiError("no", 503);
        },
      },
      "/p/demo",
    );
    expect(
      await screen.findByText("Commits y PRs revisados por los agentes configurados."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Claude/)).toBeNull();
  });

  it("lists the real agents in the empty state of the channel", async () => {
    renderWith({ health: health(["agent_1"]) }, "/p/demo");
    expect(await screen.findByText(/para que Agent_1 lo revisen/)).toBeInTheDocument();
  });

  it("lists the real agents in Settings", async () => {
    renderWith({ health: health(AGENTS) }, "/settings");
    const row = (await screen.findByText("Agentes activos")).closest(".setting") as HTMLElement;
    const chips = await within(row).findAllByRole("listitem");
    // Each chip is the avatar (the initials of an unknown agent) followed by its real name.
    expect(chips.map((chip) => chip.textContent)).toEqual(["A1Agent_1", "A2Agent_2", "GGemini"]);
    expect(row).not.toHaveTextContent("Claude");
  });

  it("shows a dash in Settings when the server does not report its agents", async () => {
    renderWith({ health: health([]) }, "/settings");
    const row = (await screen.findByText("Agentes activos")).closest(".setting") as HTMLElement;
    await waitFor(() => expect(row).toHaveTextContent("—"));
  });
});

describe("project rows with the light reviews of the real API", () => {
  // Origin: the listing brings reviews without summary or findings; the row only needs the state
  // of each agent, so the list never asks for the detail (it is the change page's job).
  const light = (agent: string, extra = {}) =>
    makeReview({
      id: `c9:${agent}:1`,
      agent,
      status: "completed",
      run: 1,
      score: 8,
      partial: true,
      ...extra,
    });

  const channel = (reviews = [light("agent_1"), light("agent_2", { status: "failed" })]) => ({
    items: [makeChange({ id: "c9", title: "con respuestas", reviews, run: 1 })],
    nextCursor: null,
  });

  it("shows each agent's state from the light reviews without requesting the detail", async () => {
    const change = vi.fn<DataSource["change"]>();
    renderWith({ changes: async () => channel(), change }, "/p/demo");

    expect(await screen.findByRole("img", { name: "Agent_1: completada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Agent_2: fallida" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver respuestas" })).toBeNull();
    expect(change).not.toHaveBeenCalled();
  });

  it("links the whole row to the change page instead of expanding it", async () => {
    renderWith({ changes: async () => channel() }, "/p/demo");
    const link = await screen.findByRole("link", { name: "con respuestas" });
    expect(link).toHaveAttribute("href", "/p/demo/changes/c9");
  });

  it("shows the expected agents as waiting for a change without reviews yet", async () => {
    renderWith(
      {
        changes: async () => ({
          items: [makeChange({ title: "recién llegado", reviews: [], reviewStatus: "pending" })],
          nextCursor: null,
        }),
      },
      "/p/demo",
    );
    expect(await screen.findByRole("img", { name: "Claude: en espera" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Codex: en espera" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Pendiente" })).toBeInTheDocument();
  });
});

describe("change detail after a retry", () => {
  // Origin: the detail mixed the reviews of every run while the backend only counts the current one.
  const retried = () =>
    makeChange({
      id: "c1",
      title: "reintentado",
      run: 2,
      reviewStatus: "completed",
      reviews: [
        makeReview({
          agent: "agent_1",
          status: "failed",
          run: 1,
          error: "boom",
          findings: [makeFinding({ message: "hallazgo del run viejo" })],
        }),
        makeReview({
          agent: "agent_1",
          status: "completed",
          run: 2,
          summary: "resumen del run nuevo",
          findings: [makeFinding({ message: "hallazgo del run nuevo", file: "b.py" })],
        }),
      ],
    });

  it("shows only the current run in the findings and the main reviews", async () => {
    renderWith({ change: async () => retried() }, "/p/demo/changes/c1");

    const panel = await screen.findByRole("region", { name: "Hallazgos" });
    expect(within(panel).getByText(/hallazgo del run nuevo/)).toBeInTheDocument();
    expect(within(panel).queryByText(/hallazgo del run viejo/)).toBeNull();
    expect(screen.getByText("resumen del run nuevo")).toBeInTheDocument();
  });

  it("keeps the earlier run collapsed and grouped by run", async () => {
    renderWith({ change: async () => retried() }, "/p/demo/changes/c1");

    const summary = await screen.findByText(/Run 1 \(anterior\) · 1 review/);
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(within(details).getByText(/Motivo: boom/)).toBeInTheDocument();

    await userEvent.click(summary);
    expect(details.open).toBe(true);
  });

  it("has no collapsed section when every review is from the current run", async () => {
    renderWith(
      {
        change: async () =>
          makeChange({
            id: "c1",
            run: 1,
            reviews: [makeReview({ run: 1, summary: "única" }), makeReview({ summary: "sin run" })],
          }),
      },
      "/p/demo/changes/c1",
    );
    expect(await screen.findByText("única")).toBeInTheDocument();
    // A review without `run` counts as run 1, like the backend's default.
    expect(screen.getByText("sin run")).toBeInTheDocument();
    expect(document.querySelector("details.previous-run")).toBeNull();
  });
});
