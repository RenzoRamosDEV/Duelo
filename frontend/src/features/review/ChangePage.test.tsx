import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../App";
import { DataSourceProvider } from "../../data/source";
import { ApiError, type DataSource } from "../../lib/api";
import { makeChange, makeFinding, makeReview, makeSource } from "../../test/fixtures";

const SLUG = "acme/widgets";

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

function renderAt(path: string, source: Partial<DataSource> = {}) {
  return render(
    <DataSourceProvider
      source={makeSource({ projects: async () => [{ slug: SLUG, name: SLUG }], ...source })}
    >
      <MemoryRouter initialEntries={[path]}>
        <App />
        <Where />
      </MemoryRouter>
    </DataSourceProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const full = makeChange({
  id: "c1",
  title: "fix: login",
  sha: "abc1234def",
  reviewStatus: "completed",
  run: 1,
  reviews: [
    makeReview({
      agent: "claude",
      run: 1,
      summary: "Todo bien",
      findings: [makeFinding({ message: "Cuidado con el nulo", file: "a.py" })],
    }),
    makeReview({ agent: "codex", run: 1, summary: "Sin objeciones" }),
  ],
});

describe("change page (its own page, not the list)", () => {
  it("opens from the row of the list with the full information", async () => {
    renderAt(`/p/${SLUG}`, {
      changes: async () => ({ items: [full], nextCursor: null }),
      change: async () => full,
    });
    await userEvent.click(await screen.findByRole("link", { name: "fix: login" }));

    expect(screen.getByTestId("where")).toHaveTextContent(`/p/${SLUG}/changes/c1`);
    expect(await screen.findByRole("heading", { name: "fix: login" })).toBeInTheDocument();
    expect(await screen.findByText("Todo bien")).toBeInTheDocument();
    expect(screen.getByText("Sin objeciones")).toBeInTheDocument();
    expect(screen.getByText("Cuidado con el nulo")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Diff" })).toBeInTheDocument();
  });

  it("has Proyectos / project / sha breadcrumbs that lead back", async () => {
    renderAt(`/p/${SLUG}/changes/c1`, {
      change: async () => full,
      changes: async () => ({ items: [full], nextCursor: null }),
    });
    const crumbs = within(await screen.findByRole("navigation", { name: "Migas" }));
    expect(crumbs.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/");
    expect(crumbs.getByRole("link", { name: `#${SLUG}` })).toHaveAttribute("href", `/p/${SLUG}`);
    expect(crumbs.getByText("abc1234")).toHaveAttribute("aria-current", "page");

    await userEvent.click(crumbs.getByRole("link", { name: `#${SLUG}` }));
    expect(await screen.findByRole("heading", { name: `#${SLUG}` })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(`/p/${SLUG}`);
  });

  it("goes back to the entry page from the first breadcrumb", async () => {
    renderAt(`/p/${SLUG}/changes/c1`, { change: async () => full });
    await userEvent.click(await screen.findByRole("link", { name: "Proyectos" }));
    expect(await screen.findByRole("heading", { name: "Proyectos" })).toBeInTheDocument();
    expect(screen.getByTestId("where")).toHaveTextContent(/^\/$/);
  });

  it("says so when the change does not exist", async () => {
    renderAt(`/p/${SLUG}/changes/nope`, {
      change: async () => {
        throw new ApiError("no", 404);
      },
    });
    expect(await screen.findByRole("heading", { name: "Change no encontrado" })).toBeVisible();
  });
});
