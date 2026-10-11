import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { DataSourceProvider } from "../data/source";
import type { DataSource } from "../lib/api";
import { makeSource } from "../test/fixtures";

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderAt(path: string, source: Partial<DataSource> = {}) {
  const full = makeSource({
    projects: async () => [
      { slug: "acme/widgets", name: "acme/widgets" },
      { slug: "duelo", name: "duelo" },
    ],
    ...source,
  });
  return render(
    <DataSourceProvider source={full}>
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </DataSourceProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("top bar (no sidebar)", () => {
  it("has no side navigation and no «Menú» button", async () => {
    renderAt("/settings");
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menú" })).toBeNull();
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Duelo" })).toHaveAttribute("href", "/");
  });

  it("links to Estadísticas and Ajustes and marks the current one", async () => {
    renderAt("/settings");
    const nav = screen.getByRole("navigation", { name: "Principal" });
    expect(within(nav).getByRole("link", { name: "Ajustes" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await userEvent.click(within(nav).getByRole("link", { name: "Estadísticas" }));
    expect(await screen.findByRole("heading", { name: "Estadísticas" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Estadísticas" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("reaches the brand, the project switcher, the links and the theme in order with Tab", async () => {
    renderAt("/p/acme/widgets");
    await screen.findByRole("combobox", { name: "Proyecto" });
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Duelo" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("combobox", { name: "Proyecto" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Estadísticas" })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("link", { name: "Ajustes" })).toHaveFocus();
  });
});

describe("project switcher", () => {
  it("shows the current project under /p/ and jumps to another one", async () => {
    renderAt("/p/acme/widgets");
    const select = await screen.findByRole("combobox", { name: "Proyecto" });
    expect(select).toHaveValue("acme/widgets");
    await userEvent.selectOptions(select, "duelo");
    expect(screen.getByTestId("where")).toHaveTextContent("/p/duelo");
    expect(screen.getByRole("combobox", { name: "Proyecto" })).toHaveValue("duelo");
  });

  it("is not shown outside a project", async () => {
    renderAt("/settings");
    await screen.findByRole("heading", { name: "Ajustes" });
    expect(screen.queryByRole("combobox", { name: "Proyecto" })).toBeNull();
  });

  it("also shows the project while viewing one of its changes", async () => {
    renderAt("/p/acme/widgets/changes/c1");
    expect(await screen.findByRole("combobox", { name: "Proyecto" })).toHaveValue("acme/widgets");
  });

  it("opens the add-project dialog from its last option without leaving the page", async () => {
    renderAt("/p/duelo");
    const select = await screen.findByRole("combobox", { name: "Proyecto" });
    await userEvent.selectOptions(select, "Añadir proyecto…");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent("/p/duelo");
  });

  it("does not invent an entry for a project that is not in the list", async () => {
    renderAt("/p/nada/existe");
    const select = await screen.findByRole("combobox", { name: "Proyecto" });
    expect(select).toHaveValue("");
    expect(within(select).getByRole("option", { name: "nada/existe" })).toBeDisabled();
  });
});
