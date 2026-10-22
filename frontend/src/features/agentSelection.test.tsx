import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { DataSourceProvider } from "../data/source";
import { ApiError, type DataSource, type ProjectRef } from "../lib/api";
import { clearIngestToken, setIngestToken } from "../lib/ingestToken";
import { makeSource } from "../test/fixtures";

const PROJECT: ProjectRef = {
  slug: "acme/widgets",
  name: "acme/widgets",
  agents: ["claude", "codex"],
};

/** Like the server: the selection saved by `setAgents` shows up in the next project list. */
function agentSource(overrides: Partial<DataSource> = {}) {
  let agents = PROJECT.agents as string[];
  return makeSource({
    projects: async () => [{ ...PROJECT, agents }],
    setAgents: vi.fn(async (_slug: string, chosen: readonly string[]) => {
      agents = [...chosen];
      return { ...PROJECT, agents };
    }),
    ...overrides,
  });
}

function renderSettings(source: DataSource) {
  return render(
    <DataSourceProvider source={source}>
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>
    </DataSourceProvider>,
  );
}

const picker = async () =>
  within(await screen.findByRole("group", { name: "Agentes que revisan" }));

beforeEach(() => {
  clearIngestToken();
  setIngestToken("tok");
});
afterEach(() => vi.restoreAllMocks());

describe("agent selection in settings", () => {
  it("shows the saved selection and keeps Guardar off until something changes", async () => {
    renderSettings(agentSource());
    const group = await picker();
    expect(group.getByRole("checkbox", { name: "Claude" })).toBeChecked();
    expect(group.getByRole("checkbox", { name: "Codex" })).toBeChecked();
    expect(group.getByRole("button", { name: /Guardar agentes/ })).toBeDisabled();
  });

  it("saves only Codex with the token and shows the saved selection", async () => {
    const source = agentSource();
    renderSettings(source);
    const group = await picker();

    await userEvent.click(group.getByRole("checkbox", { name: "Claude" }));
    await userEvent.click(group.getByRole("button", { name: /Guardar agentes/ }));

    expect(source.setAgents).toHaveBeenCalledWith("acme/widgets", ["codex"], "tok");
    expect(await screen.findByText(/Agentes guardados: Codex/)).toBeInTheDocument();
    expect((await picker()).getByRole("checkbox", { name: "Claude" })).not.toBeChecked();
  });

  it("asks for the projects again right after saving the agents", async () => {
    const source = agentSource();
    const projects = vi.spyOn(source, "projects");
    renderSettings(source);
    const group = await picker();
    await userEvent.click(group.getByRole("checkbox", { name: "Claude" }));
    const before = projects.mock.calls.length;
    await userEvent.click(group.getByRole("button", { name: /Guardar agentes/ }));
    await screen.findByText(/Agentes guardados: Codex/);
    expect(projects).toHaveBeenCalledTimes(before + 1);
  });

  it("does not let you save with every agent unchecked", async () => {
    const source = agentSource();
    renderSettings(source);
    const group = await picker();

    await userEvent.click(group.getByRole("checkbox", { name: "Claude" }));
    await userEvent.click(group.getByRole("checkbox", { name: "Codex" }));

    expect(group.getByRole("button", { name: /Guardar agentes/ })).toBeDisabled();
    expect(group.getByText("Elige al menos uno.")).toBeInTheDocument();
    expect(source.setAgents).not.toHaveBeenCalled();
  });

  it("says the token is invalid on 401 and keeps the saved selection", async () => {
    renderSettings(
      agentSource({
        setAgents: vi.fn(async () => {
          throw new ApiError("no", 401);
        }),
      }),
    );
    const group = await picker();

    await userEvent.click(group.getByRole("checkbox", { name: "Codex" }));
    await userEvent.click(group.getByRole("button", { name: /Guardar agentes/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Token de ingesta no válido.");
  });

  it.each([
    [422, "Selección no válida: raw"],
    [404, "El proyecto ya no existe."],
    [500, "No se pudo guardar los agentes: raw"],
  ])("shows the exact text of today when saving fails with %i (golden)", async (status, text) => {
    renderSettings(
      agentSource({
        setAgents: vi.fn(async () => {
          throw new ApiError("raw", status);
        }),
      }),
    );
    const group = await picker();
    await userEvent.click(group.getByRole("checkbox", { name: "Codex" }));
    await userEvent.click(group.getByRole("button", { name: /Guardar agentes/ }));
    expect((await screen.findByRole("alert")).textContent).toBe(text);
  });
});
