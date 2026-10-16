// The channel page mounted inside the whole app, over a fake data source.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Change } from "../../data/types";
import { ApiError, type ChangePage, type DataSource } from "../../lib/api";
import { makeChange, makeReview } from "../../test/fixtures";
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

const light = (agent: string, status: "completed" | "failed" | "running") =>
  makeReview({ agent, status, partial: true });

const changes = (items: Change[]): Partial<DataSource> => ({
  changes: async () => ({ items, nextCursor: null }),
});

afterEach(() => vi.restoreAllMocks());

describe("load states", () => {
  it("shows a recoverable error and then the channel after retrying", async () => {
    const changes = vi
      .fn<DataSource["changes"]>()
      .mockRejectedValueOnce(new ApiError("El servidor respondió 503.", 503))
      .mockResolvedValue({ items: [makeChange({ title: "hola" })], nextCursor: null });
    renderWith({ changes }, "/p/demo");
    expect(await screen.findByRole("alert")).toHaveTextContent("503");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("hola")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows 'not found' instead of a generic error on 404", async () => {
    renderWith(
      {
        changes: async () => {
          throw new ApiError("x", 404);
        },
      },
      "/p/nope",
    );
    expect(await screen.findByRole("heading", { name: "Proyecto no encontrado" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reintentar" })).toBeNull();
  });
});

describe("load more", () => {
  const page = (ids: string[], nextCursor: string | null): ChangePage => ({
    items: ids.map((id) => makeChange({ id, title: `change ${id}`, sha: `sha${id}` })),
    nextCursor,
  });

  it("appends the next page without duplicates and hides the button at the end", async () => {
    const changes = vi.fn<DataSource["changes"]>(async (_slug, q) =>
      q?.cursor ? page(["b", "c"], null) : page(["a", "b"], "cur1"),
    );
    renderWith({ changes }, "/p/demo");
    await screen.findByText("change a");
    await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByText("change c");
    expect(screen.getAllByText("change b")).toHaveLength(1);
    expect(changes).toHaveBeenLastCalledWith("demo", { cursor: "cur1" });
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
  });

  it("sends the search and the filters again when loading more", async () => {
    const changes = vi.fn<DataSource["changes"]>(async (_s, q) =>
      q?.cursor ? page(["c"], null) : page(["a", "b"], "cur1"),
    );
    renderWith({ changes }, "/p/demo");
    await screen.findByText("change a");
    await userEvent.click(screen.getByRole("button", { name: "Con fallos" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cambios" }), " sha ");
    await waitFor(() =>
      expect(changes).toHaveBeenLastCalledWith("demo", {
        status: ["failed", "partial_failed"],
        q: "sha",
      }),
    );
    await userEvent.click(await screen.findByRole("button", { name: "Cargar más" }));
    await screen.findByText("change c");
    expect(changes).toHaveBeenLastCalledWith("demo", {
      status: ["failed", "partial_failed"],
      q: "sha",
      cursor: "cur1",
    });
  });

  it("keeps what is shown when loading more fails and allows retrying", async () => {
    const changes = vi
      .fn<DataSource["changes"]>()
      .mockResolvedValueOnce(page(["a"], "cur1"))
      .mockRejectedValueOnce(new ApiError("boom", 500))
      .mockResolvedValueOnce(page(["b"], null));
    renderWith({ changes }, "/p/demo");
    await screen.findByText("change a");
    await userEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudieron cargar más cambios.",
    );
    expect(screen.getByText("change a")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("change b")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("restarts the list and the cursor when the kind filter changes", async () => {
    const changes = vi.fn<DataSource["changes"]>(async (_s, q) =>
      q?.kind === "pr" ? page(["p1"], null) : page(["a"], "cur1"),
    );
    renderWith({ changes }, "/p/demo");
    await screen.findByText("change a");
    await userEvent.click(screen.getByRole("button", { name: "PRs" }));
    await screen.findByText("change p1");
    expect(screen.queryByText("change a")).toBeNull();
    expect(screen.queryByRole("button", { name: "Cargar más" })).toBeNull();
    expect(changes).toHaveBeenLastCalledWith("demo", { kind: "pr" });
  });
});

describe("server-side filters", () => {
  const items = (...titles: string[]) =>
    titles.map((title) => makeChange({ id: title, title, reviews: undefined }));

  it("maps each state filter to the server statuses and shows only what the server returns", async () => {
    const changes = vi.fn<DataSource["changes"]>(async (_s, q) => {
      const status = q?.status?.join(",");
      if (status === "pending,running") return { items: items("en curso"), nextCursor: null };
      if (status === "failed,partial_failed")
        return { items: items("con fallo"), nextCursor: null };
      if (status === "completed") return { items: items("completado"), nextCursor: null };
      return { items: items("todos"), nextCursor: null };
    });
    renderWith({ changes }, "/p/demo");
    await screen.findByText("todos");
    for (const [button, title] of [
      ["En curso", "en curso"],
      ["Con fallos", "con fallo"],
      ["Completados", "completado"],
      ["Todos", "todos"],
    ]) {
      await userEvent.click(screen.getByRole("button", { name: button }));
      expect(await screen.findByText(title)).toBeInTheDocument();
    }
    expect(changes.mock.calls.map(([, q]) => q?.status)).toEqual([
      undefined,
      ["pending", "running"],
      ["failed", "partial_failed"],
      ["completed"],
      undefined,
    ]);
  });

  it("sends q, kind and status together and restarts the cursor on every change", async () => {
    const changes = vi.fn<DataSource["changes"]>(async (_s, q) =>
      q?.cursor
        ? { items: items("pagina 2"), nextCursor: null }
        : { items: items("pagina 1"), nextCursor: "cur1" },
    );
    renderWith({ changes }, "/p/demo");
    await userEvent.click(await screen.findByRole("button", { name: "Cargar más" }));
    await screen.findByText("pagina 2");
    await userEvent.click(screen.getByRole("button", { name: "Completados" }));
    await waitFor(() => expect(screen.queryByText("pagina 2")).toBeNull());
    expect(await screen.findByText("pagina 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "PRs" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cambios" }), "fix");
    await waitFor(() =>
      expect(changes).toHaveBeenLastCalledWith("demo", {
        kind: "pr",
        status: ["completed"],
        q: "fix",
      }),
    );
    expect(changes.mock.calls.at(-1)?.[1]?.cursor).toBeUndefined();
  });

  it("does not send q while the search is blank and debounces typing", async () => {
    const changes = vi.fn<DataSource["changes"]>(async () => ({
      items: items("x"),
      nextCursor: null,
    }));
    renderWith({ changes }, "/p/demo");
    await screen.findByText("x");
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cambios" }), "   ");
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(changes).toHaveBeenCalledTimes(1);
    await userEvent.type(screen.getByRole("searchbox", { name: "Buscar cambios" }), "abc");
    await waitFor(() => expect(changes).toHaveBeenCalledTimes(2));
    expect(changes.mock.calls[1][1]?.q).toBe("abc");
  });

  it("ignores a late response for a filter that is no longer selected", async () => {
    let releaseSlow: (page: ChangePage) => void = () => {};
    const slow = new Promise<ChangePage>((resolve) => {
      releaseSlow = resolve;
    });
    const changes = vi.fn<DataSource["changes"]>(async (_s, q) =>
      q?.kind === "commit" ? slow : { items: items("vigente"), nextCursor: null },
    );
    renderWith({ changes }, "/p/demo");
    await screen.findByText("vigente");
    await userEvent.click(screen.getByRole("button", { name: "Commits" }));
    await userEvent.click(screen.getByRole("button", { name: "PRs" }));
    await screen.findByText("vigente");
    releaseSlow({ items: items("obsoleto"), nextCursor: null });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByText("obsoleto")).toBeNull();
    expect(screen.getByText("vigente")).toBeInTheDocument();
  });
});

describe("change age", () => {
  it("shows the relative age with the absolute date in <time>", async () => {
    const createdAt = "2026-10-09T11:48:00Z";
    renderWithNow(
      { changes: async () => ({ items: [makeChange({ createdAt })], nextCursor: null }) },
      "/p/demo",
    );
    const time = await screen.findByText("hace 12 min");
    expect(time.tagName).toBe("TIME");
    expect(time).toHaveAttribute("datetime", createdAt);
    expect(time).toHaveAttribute("title");
  });

  it("omits the age when the change has no date", async () => {
    renderWithNow(
      { changes: async () => ({ items: [makeChange({ title: "x" })], nextCursor: null }) },
      "/p/demo",
    );
    await screen.findByText("x");
    expect(document.querySelector("time")).toBeNull();
  });
});

describe("compact channel", () => {
  const items = [
    makeChange({ title: "alpha", author: "ana" }),
    makeChange({ title: "beta", author: "bob" }),
  ];

  it("searches by author and lists one compact row per match, with no density switch", async () => {
    const changes: DataSource["changes"] = async (_slug, query) => ({
      items: items.filter((c) => !query?.q || c.author === query.q),
      nextCursor: null,
    });
    renderWithNow({ changes }, "/p/demo");
    await screen.findByText("alpha");
    expect(screen.queryByRole("button", { name: "Compacta" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Tarjetas" })).toBeNull();

    await userEvent.type(screen.getByRole("searchbox"), "ana");
    // Wait for the filtered result itself: "beta" also disappears while the list is loading.
    await waitFor(() => expect(document.querySelectorAll(".change-row")).toHaveLength(1));
    expect(screen.queryByText("beta")).toBeNull();
    expect(screen.getByRole("searchbox")).toHaveValue("ana");
  });
});

describe("actionable empty state", () => {
  it("shows the ingest command with the slug and a token placeholder", async () => {
    renderWithNow({}, "/p/demo");
    expect(await screen.findByText("Aún no hay cambios en este canal.")).toBeInTheDocument();
    const command = document.querySelector(".command code")?.textContent ?? "";
    expect(command).toContain('"project":"demo"');
    expect(command).toContain("$INGEST_TOKEN");
    expect(screen.getByRole("button", { name: "Copiar comando" })).toBeInTheDocument();
  });

  it("does not show it when a filter simply matches nothing", async () => {
    const changes: DataSource["changes"] = async (_slug, query) => ({
      items: query?.q ? [] : [makeChange({ title: "x" })],
      nextCursor: null,
    });
    renderWithNow({ changes }, "/p/demo");
    await screen.findByText("x");
    await userEvent.type(screen.getByRole("searchbox"), "zzz");
    expect(await screen.findByText("Ningún cambio coincide con la búsqueda.")).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay cambios en este canal.")).toBeNull();
  });
});

describe("aggregate status in the row", () => {
  it("shows the aggregate status as the row icon when the listing has no reviews", async () => {
    renderWith(
      {
        changes: async () => ({
          items: [makeChange({ title: "x", reviews: undefined, reviewStatus: "partial_failed" })],
          nextCursor: null,
        }),
      },
      "/p/demo",
    );
    expect(await screen.findByRole("img", { name: "Fallo parcial" })).toBeInTheDocument();
  });

  it("shows the state icon and one check per agent when the reviews are present", async () => {
    renderWith(
      {
        changes: async () => ({
          items: [
            makeChange({
              title: "x",
              reviewStatus: "completed",
              reviews: [makeReview({ agent: "claude" }), makeReview({ agent: "codex" })],
            }),
          ],
          nextCursor: null,
        }),
      },
      "/p/demo",
    );
    expect(await screen.findByRole("img", { name: "Completada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Claude: completada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Codex: completada" })).toBeInTheDocument();
  });
});

describe("channel rows (GitHub-style list)", () => {
  const rows = [
    makeChange({
      title: "fix: login",
      author: "ana",
      sha: "abc1234def",
      reviewStatus: "completed",
      reviews: [light("agent_1", "completed"), light("agent_2", "completed")],
    }),
    makeChange({
      title: "feat: pagos",
      author: "bob",
      sha: "fff0000aaa",
      reviewStatus: "partial_failed",
      reviews: [light("agent_1", "completed"), light("agent_2", "failed")],
    }),
    makeChange({ title: "chore: deps", author: "eva", reviewStatus: "pending", reviews: [] }),
  ];

  it("shows a state icon with a text alternative on every row", async () => {
    renderWithAgents(changes(rows), "/p/demo");
    await screen.findByText("fix: login");
    expect(screen.getByRole("img", { name: "Completada" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Fallo parcial" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Pendiente" })).toBeInTheDocument();
  });

  it("writes the short SHA with a hash and the author, like a PR list", async () => {
    renderWithAgents(changes(rows), "/p/demo");
    const row = (await screen.findByText("fix: login")).closest("li") as HTMLElement;
    expect(row).toHaveTextContent("#abc1234 · por ana");
  });

  it("shows one check per agent with its state as text", async () => {
    renderWithAgents(changes(rows), "/p/demo");
    await screen.findByText("feat: pagos");
    const row = within((await screen.findByText("feat: pagos")).closest("li") as HTMLElement);
    const checks = row.getByRole("list", { name: "Respuesta de cada agente" });
    expect(within(checks).getByRole("img", { name: "Agent_1: completada" })).toBeInTheDocument();
    expect(within(checks).getByRole("img", { name: "Agent_2: fallida" })).toBeInTheDocument();
  });

  it("shows the expected agents as waiting for a change nobody has reviewed yet", async () => {
    renderWithAgents(changes(rows), "/p/demo");
    const row = within((await screen.findByText("chore: deps")).closest("li") as HTMLElement);
    expect(await row.findByRole("img", { name: "Agent_1: en espera" })).toBeInTheDocument();
    expect(row.getByRole("img", { name: "Agent_2: en espera" })).toBeInTheDocument();
  });

  it("counts what is loaded by state in the list header", async () => {
    renderWithAgents(changes(rows), "/p/demo");
    await screen.findByText("fix: login");
    expect(screen.getByText(/3 cambios · 1 en curso · 1 con fallos · 1 completados/)).toBeVisible();
  });

  it("flags that there may be more than what is counted when another page exists", async () => {
    renderWithAgents({ changes: async () => ({ items: rows, nextCursor: "next" }) }, "/p/demo");
    await screen.findByText("fix: login");
    expect(screen.getByText(/3\+ cambios/)).toBeVisible();
  });

  it("styles the state filter as tabs and keeps them pressable", async () => {
    renderWithAgents(changes(rows), "/p/demo");
    await screen.findByText("fix: login");
    const tabs = screen.getByRole("group", { name: "Estado de la review" });
    expect(within(tabs).getByRole("button", { name: "Todos" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("«/» focuses the search", () => {
  it("focuses the search box without typing a slash into it", async () => {
    renderWithAgents({}, "/p/demo");
    const search = await screen.findByRole("searchbox", { name: "Buscar cambios" });
    expect(search).not.toHaveFocus();
    await userEvent.keyboard("/");
    expect(search).toHaveFocus();
    expect(search).toHaveValue("");
  });

  it("does not steal the key while the user is typing somewhere else", async () => {
    renderWithAgents({}, "/p/demo");
    const search = await screen.findByRole("searchbox", { name: "Buscar cambios" });
    await userEvent.type(search, "a/b");
    expect(search).toHaveValue("a/b");
  });

  it("ignores it when a modal is open", async () => {
    renderWithAgents({}, "/p/demo");
    const search = await screen.findByRole("searchbox", { name: "Buscar cambios" });
    const dialog = document.createElement("dialog");
    dialog.setAttribute("open", "");
    document.body.append(dialog);
    await userEvent.keyboard("/");
    expect(search).not.toHaveFocus();
    dialog.remove();
  });
});

describe("loading placeholders", () => {
  it("draws loading placeholders, hidden from assistive technology, while the channel loads", async () => {
    let resolve: (v: { items: Change[]; nextCursor: null }) => void = () => {};
    renderWithAgents(
      {
        changes: () =>
          new Promise((r) => {
            resolve = r;
          }),
      },
      "/p/demo",
    );
    const placeholder = await waitFor(() => {
      const el = document.querySelector(".skeleton");
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(placeholder).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByText("Cargando cambios…")).toBeInTheDocument();
    resolve({ items: [], nextCursor: null });
    await waitFor(() => expect(document.querySelector(".skeleton")).toBeNull());
  });
});
