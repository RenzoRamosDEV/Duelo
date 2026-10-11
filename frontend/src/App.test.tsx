import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function setReducedMotion(reduced: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: reduced && query.includes("reduce"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

afterEach(() => vi.restoreAllMocks());

const changeLinks = () =>
  screen.getAllByRole("link").filter((a) => a.getAttribute("href")?.includes("/changes/"));

describe("navigation", () => {
  it("opens on the project picker and does not jump into the first project", async () => {
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Proyectos" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /duelo/ })).toHaveAttribute("href", "/p/duelo");
    expect(screen.queryByRole("heading", { name: "#duelo" })).toBeNull();
  });

  it("goes from the picker to a project and marks nothing as a sidebar channel", async () => {
    renderAt("/");
    await userEvent.click(await screen.findByRole("link", { name: /duelo/ }));
    expect(await screen.findByRole("heading", { name: "#duelo" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Proyecto" })).toHaveValue("duelo");
  });

  it("navigates to stats and settings from the top bar", async () => {
    renderAt("/");
    const nav = screen.getByRole("navigation", { name: "Principal" });
    await userEvent.click(within(nav).getByRole("link", { name: "Estadísticas" }));
    expect(screen.getByRole("heading", { name: "Estadísticas" })).toBeInTheDocument();
    await userEvent.click(within(nav).getByRole("link", { name: "Ajustes" }));
    expect(screen.getByRole("heading", { name: "Ajustes" })).toBeInTheDocument();
  });
});

describe("project page: compact list", () => {
  it("lists one row per change, each a single link to its page, with no thread", async () => {
    renderAt("/p/duelo");
    await screen.findByText("feat: exponer ingesta de commits");
    // Four commits (two of them undone) and one PR.
    expect(changeLinks()).toHaveLength(5);
    expect(screen.queryByRole("button", { name: "Ver respuestas" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Compacta" })).toBeNull();
  });

  it("filters by SHA and combines with the kind filter", async () => {
    renderAt("/p/duelo");
    await screen.findByText("feat: exponer ingesta de commits");
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cambios" }), "9BE0");
    await waitFor(() => expect(changeLinks()).toHaveLength(1));
    expect(screen.getByText("feat: exponer ingesta de commits")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Commits" }));
    expect(await screen.findByText("Ningún cambio coincide con la búsqueda.")).toBeInTheDocument();
  });

  it("tells an empty channel apart from no matches", async () => {
    renderAt("/p/acme/widgets");
    expect(await screen.findByText("Aún no hay cambios en este canal.")).toBeInTheDocument();
  });

  it("filters by kind", async () => {
    renderAt("/p/duelo");
    await screen.findByText("feat: exponer ingesta de commits");
    expect(changeLinks()).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: "PRs" }));
    await waitFor(() => expect(changeLinks()).toHaveLength(1));
  });

  it("opens the change page when a row is followed, and the breadcrumb comes back", async () => {
    renderAt("/p/duelo");
    await screen.findByText("feat: exponer ingesta de commits");
    await userEvent.click(changeLinks()[0]);
    expect(await screen.findByLabelText("Diff")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("link", { name: "#duelo" }));
    expect(await screen.findByRole("heading", { name: "#duelo" })).toBeInTheDocument();
  });
});

describe("review states", () => {
  it("shows thinking indicator and beam for a running review", async () => {
    setReducedMotion(false);
    const { container } = renderAt("/p/duelo/changes/c1");
    expect(await screen.findByText("Codex está revisando…")).toBeInTheDocument();
    expect(screen.getAllByText("En curso").length).toBeGreaterThan(0);
    expect(container.querySelector('[data-status="running"]')).not.toBeNull();
    expect(screen.getByText("Completada")).toBeInTheDocument();
  });

  it("shows failed state as text without thinking indicator", async () => {
    renderAt("/p/duelo/changes/c2");
    expect(await screen.findByText("Fallida")).toBeInTheDocument();
    expect(screen.queryByText(/está revisando/)).toBeNull();
  });

  it("falls back to a static indicator with reduced motion", async () => {
    setReducedMotion(true);
    const { container } = renderAt("/p/duelo/changes/c1");
    expect(await screen.findByText("Codex está revisando…")).toBeInTheDocument();
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector("[data-beam-bloom]")).toBeNull();
  });
});

describe("other screens", () => {
  it("renders the change detail with diff and both reviews", async () => {
    renderAt("/p/duelo/changes/c1");
    expect(await screen.findByLabelText("Diff")).toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("numbers diff lines and marks additions and deletions", async () => {
    renderAt("/p/duelo/changes/c1");
    const diff = await screen.findByRole("table", { name: "Diff" });
    expect(within(diff).getByText("src/ingest.py")).toBeInTheDocument();
    expect(within(diff).getAllByText(/^\+ /).length).toBeGreaterThan(0);
    expect(diff.querySelectorAll("tr.del").length).toBeGreaterThan(0);
    expect(diff.querySelector("tr.add td.ln:nth-child(2)")?.textContent).toBe("1");
  });

  it("warns only when the diff is truncated", async () => {
    const { unmount } = renderAt("/p/duelo/changes/c1");
    await screen.findByRole("table", { name: "Diff" });
    expect(screen.queryByRole("note")).toBeNull();
    unmount();
    renderAt("/p/duelo/changes/c2");
    expect(await screen.findByRole("note")).toHaveTextContent("truncado");
  });

  it("keeps stats values as text and hides the bars from assistive tech", async () => {
    const { container } = renderAt("/stats");
    expect(await screen.findByRole("row", { name: /Claude/ })).toHaveTextContent("42 s");
    expect(screen.getByRole("row", { name: /Claude/ })).toHaveTextContent("4,1");
    const meters = container.querySelectorAll(".meter");
    expect(meters.length).toBe(4);
    for (const m of meters) expect(m).toHaveAttribute("aria-hidden", "true");
  });

  it("renders stats rows per agent", async () => {
    renderAt("/stats");
    expect(await screen.findByRole("row", { name: /Claude/ })).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Codex/ })).toBeInTheDocument();
  });

  it("renders settings", async () => {
    renderAt("/settings");
    expect(screen.getByText("Voto ciego")).toBeInTheDocument();
    expect(await screen.findByText("Postgres")).toBeInTheDocument();
  });
});
