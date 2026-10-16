import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { DataSourceProvider } from "../../data/source";
import { ApiError, type DataSource, type ProjectRef } from "../../lib/api";
import { makeSource } from "../../test/fixtures";

const PROJECTS: ProjectRef[] = [
  {
    slug: "acme/widgets",
    name: "acme/widgets",
    path: "/home/u/widgets",
    hooksInstalled: true,
    github: true,
  },
  { slug: "duelo", name: "duelo" },
];

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderHome(source: Partial<DataSource> = {}) {
  return render(
    <DataSourceProvider source={makeSource({ projects: async () => PROJECTS, ...source })}>
      <MemoryRouter initialEntries={["/"]}>
        <App />
        <Where />
      </MemoryRouter>
    </DataSourceProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("project picker (entry page)", () => {
  it("lists every project as a card linked to its page, without redirecting", async () => {
    renderHome();
    expect(await screen.findByRole("heading", { name: "Proyectos" })).toBeInTheDocument();
    const widgets = await screen.findByRole("link", { name: /acme\/widgets/ });
    expect(widgets).toHaveAttribute("href", "/p/acme/widgets");
    expect(screen.getByRole("link", { name: /duelo/ })).toHaveAttribute("href", "/p/duelo");
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("shows the GitHub, local and hooks labels and the path only when they apply", async () => {
    renderHome();
    const widgets = await screen.findByRole("link", { name: /acme\/widgets/ });
    for (const label of ["GitHub", "Local", "Hooks"]) {
      expect(within(widgets).getByText(label)).toBeInTheDocument();
    }
    expect(within(widgets).getByText("/home/u/widgets")).toBeInTheDocument();
    const duelo = screen.getByRole("link", { name: /duelo/ });
    expect(within(duelo).queryByText("GitHub")).toBeNull();
    expect(within(duelo).queryByText("Local")).toBeNull();
  });

  it("opens a project when its card is clicked", async () => {
    renderHome({ changes: async () => ({ items: [], nextCursor: null }) });
    await userEvent.click(await screen.findByRole("link", { name: /duelo/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/p/duelo");
  });

  it("opens the add-project dialog from its card", async () => {
    renderHome();
    await userEvent.click(await screen.findByRole("button", { name: "Añadir proyecto" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("offers to add the first project when there are none", async () => {
    renderHome({ projects: async () => [] });
    expect(await screen.findByText("Aún no hay proyectos vigilados.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Añadir proyecto" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("explains the failure and retries", async () => {
    const projects = vi
      .fn<() => Promise<ProjectRef[]>>()
      .mockRejectedValueOnce(new ApiError("No se pudo conectar.", 500))
      .mockResolvedValue(PROJECTS);
    renderHome({ projects });
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar.");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByRole("link", { name: /duelo/ })).toBeInTheDocument();
  });
});

describe("entry page without projects", () => {
  it("shows the empty state when the API has no projects", async () => {
    renderHome({ projects: async () => [] });
    expect(await screen.findByText("Aún no hay proyectos vigilados.")).toBeInTheDocument();
  });

  it("explains an empty installation and offers the primary action", async () => {
    renderHome({ projects: async () => [] });
    expect(await screen.findByText("Aún no hay proyectos vigilados.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Añadir proyecto" }).length).toBeGreaterThan(0);
  });
});
