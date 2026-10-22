// The change detail page mounted inside the whole app, over a fake data source.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Change, ReviewAggregate } from "../../data/types";
import { ApiError, type DataSource } from "../../lib/api";
import * as diff from "../../lib/diff";
import { clearIngestToken, getIngestToken } from "../../lib/ingestToken";
import { makeChange, makeFinding, makeReview } from "../../test/fixtures";
import { renderApp } from "../../test/render";
import * as findingsPanel from "./FindingsPanel";

// Spies that keep the real behaviour: they count how often the page parses the diff and what
// `reviews` the findings panel receives.
vi.mock("../../lib/diff", async (importOriginal) => {
  const actual = await importOriginal<typeof diff>();
  return { ...actual, parseDiff: vi.fn(actual.parseDiff) };
});
vi.mock("./FindingsPanel", async (importOriginal) => {
  const actual = await importOriginal<typeof findingsPanel>();
  return { ...actual, FindingsPanel: vi.fn(actual.FindingsPanel) };
});

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

beforeEach(clearIngestToken);

afterEach(() => vi.restoreAllMocks());

describe("change detail", () => {
  const detail = makeChange({
    id: "d1",
    title: "detalle",
    sha: "0123456789abcdef",
    ref: "feat/x",
    url: "https://github.com/o/r/pull/9",
    diff: "+a",
    reviews: [
      makeReview({
        agent: "claude",
        findings: [makeFinding({ file: "x.py", severity: "low", line: 8, message: "menor" })],
      }),
      makeReview({
        agent: "codex",
        findings: [makeFinding({ file: "x.py", severity: "critical", line: 2, message: "grave" })],
      }),
    ],
  });

  it("groups findings by file, most severe first, with the agent", async () => {
    renderWith({ change: async () => detail }, "/p/demo/changes/d1");
    const panel = await screen.findByRole("region", { name: "Hallazgos" });
    expect(within(panel).getAllByRole("heading", { level: 4 })).toHaveLength(1);
    const items = within(panel).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Crítico");
    expect(items[0]).toHaveTextContent("Codex");
    expect(items[1]).toHaveTextContent("menor");
  });

  // Regresión: con la API real (FakeAgent) salían `N/A` y `L0` y los agentes figuraban como «Claude».
  it("shows unlocated findings under 'Sin archivo' without N/A or L0, and the real agent name", async () => {
    renderWith(
      {
        change: async () => ({
          ...detail,
          reviews: [
            makeReview({
              agent: "agent_1",
              findings: [makeFinding({ file: "N/A", line: 0, severity: "nit", message: "suelto" })],
            }),
            makeReview({
              agent: "agent_2",
              findings: [makeFinding({ file: "x.py", line: 3, message: "localizado" })],
            }),
          ],
        }),
      },
      "/p/demo/changes/d1",
    );
    const panel = await screen.findByRole("region", { name: "Hallazgos" });
    const headings = within(panel).getAllByRole("heading", { level: 4 });
    expect(headings.map((h) => h.textContent)).toEqual(["x.py", "Sin archivo"]);
    expect(
      screen.getByRole("heading", { level: 2, name: "Revisión de los agentes" }),
    ).toBeInTheDocument();
    expect(within(panel).getByRole("heading", { level: 3 })).toHaveTextContent("Hallazgos");

    expect(panel).not.toHaveTextContent("N/A");
    expect(panel).not.toHaveTextContent("L0");
    expect(panel).toHaveTextContent("L3");
    expect(panel).toHaveTextContent("Agent_1");
    expect(panel).not.toHaveTextContent("Claude");
    const cards = screen.getAllByRole("article");
    expect(cards[0]).toHaveTextContent("Agent_1");
    expect(cards[1]).toHaveTextContent("Agent_2");
    for (const card of cards) expect(card).not.toHaveTextContent("Claude");
    expect(cards[0]).not.toHaveTextContent("N/A");
  });

  it("omits the findings panel when there are none", async () => {
    renderWith(
      { change: async () => ({ ...detail, reviews: [makeReview()] }) },
      "/p/demo/changes/d1",
    );
    await screen.findByLabelText("Diff");
    expect(screen.queryByRole("region", { name: "Hallazgos" })).toBeNull();
  });

  it("opens the change in a new tab only for http(s) URLs", async () => {
    const { unmount } = renderWith({ change: async () => detail }, "/p/demo/changes/d1");
    const link = await screen.findByRole("link", { name: "Abrir en GitHub" });
    expect(link).toHaveAttribute("href", "https://github.com/o/r/pull/9");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    unmount();
    renderWith(
      { change: async () => ({ ...detail, url: "javascript:alert(1)" }) },
      "/p/demo/changes/d1",
    );
    await screen.findByLabelText("Diff");
    expect(screen.queryByRole("link", { name: "Abrir en GitHub" })).toBeNull();
  });

  it("copies the full SHA and announces it as text", async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWith({ change: async () => detail }, "/p/demo/changes/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Copiar SHA" }));
    expect(writeText).toHaveBeenCalledWith("0123456789abcdef");
    await waitFor(() => expect(screen.getByText("Copiado")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Copiar rama" }));
    expect(writeText).toHaveBeenLastCalledWith("feat/x");
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("announces a failed copy", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    document.execCommand = vi.fn(() => false);
    renderWith({ change: async () => detail }, "/p/demo/changes/d1");
    await userEvent.click(await screen.findByRole("button", { name: "Copiar SHA" }));
    expect(await screen.findByText("No se pudo copiar")).toBeInTheDocument();
  });

  it("shows 'not found' for an unknown change", async () => {
    renderWith({}, "/p/demo/changes/zzz");
    expect(await screen.findByRole("heading", { name: "Change no encontrado" })).toBeVisible();
  });
});

describe("diff file navigator", () => {
  const diff = [
    "diff --git a/a.py b/a.py",
    "index 1..2 100644",
    "--- a/a.py",
    "+++ b/a.py",
    "@@ -1,2 +1,3 @@",
    " keep",
    "-old",
    "+new",
    "+extra",
    "diff --git a/b.py b/b.py",
    "--- a/b.py",
    "+++ b/b.py",
    "@@ -1,1 +1,2 @@",
    " keep",
    "+only",
  ].join("\n");

  it("lists each file with its counts and links to its section", async () => {
    renderWithNow({ change: async () => makeChange({ id: "c1", diff }) }, "/p/demo/changes/c1");
    const nav = await screen.findByRole("navigation", { name: "Archivos del diff" });
    expect(within(nav).getByRole("heading")).toHaveTextContent("2 archivos");
    const [first, second] = within(nav).getAllByRole("listitem");
    expect(first).toHaveTextContent("a.py +2 −1");
    expect(second).toHaveTextContent("b.py +1 −0");
    const href = within(second).getByRole("link", { name: "b.py" }).getAttribute("href");
    const target = document.getElementById(String(href).slice(1));
    expect(target).not.toBeNull();
    expect(target).toHaveTextContent("b.py");
  });

  it("does not render the navigator when the diff has no file names", async () => {
    renderWithNow(
      { change: async () => makeChange({ id: "c1", diff: "@@ -1,1 +1,2 @@\n ctx\n+n" }) },
      "/p/demo/changes/c1",
    );
    await screen.findByRole("table", { name: "Diff" });
    expect(screen.queryByRole("navigation", { name: "Archivos del diff" })).toBeNull();
  });
});

describe("retry review", () => {
  const failed = (overrides: Partial<Change> = {}) =>
    makeChange({
      id: "d1",
      title: "detalle",
      reviewStatus: "failed",
      run: 1,
      reviews: [makeReview({ status: "failed" })],
      ...overrides,
    });
  const path = "/p/demo/changes/d1";
  const retryButton = () => screen.getByRole("button", { name: "Reintentar review" });
  const tokenField = () => screen.getByLabelText("Token de ingesta");

  it.each<ReviewAggregate>(["pending", "running", "completed"])(
    "is hidden when the change is %s",
    async (reviewStatus) => {
      renderWith({ change: async () => failed({ reviewStatus }) }, path);
      await screen.findByRole("heading", { name: "detalle" });
      expect(screen.queryByRole("button", { name: "Reintentar review" })).toBeNull();
      expect(screen.queryByLabelText("Token de ingesta")).toBeNull();
    },
  );

  it.each<ReviewAggregate>(["failed", "partial_failed"])("is offered when %s", async (status) => {
    renderWith({ change: async () => failed({ reviewStatus: status }) }, path);
    expect(await screen.findByRole("button", { name: "Reintentar review" })).toBeInTheDocument();
    expect(tokenField()).toHaveAttribute("type", "password");
  });

  it("shows the aggregate status and the run in the header", async () => {
    renderWith({ change: async () => failed({ reviewStatus: "partial_failed", run: 3 }) }, path);
    expect(await screen.findByText("Fallo parcial")).toBeInTheDocument();
    expect(screen.getByText("Run 3")).toBeInTheDocument();
  });

  it("asks for the token and does not call the API without one", async () => {
    const retry = vi.fn<DataSource["retry"]>();
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.click(retryButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Introduce el token");
    expect(retry).not.toHaveBeenCalled();
  });

  it("sends the trimmed token, announces the new run and reloads the detail", async () => {
    let current = failed();
    const retry = vi.fn<DataSource["retry"]>(async () => {
      current = failed({ reviewStatus: "pending", run: 2, reviews: [] });
      return { changeId: "d1", run: 2 };
    });
    const change = vi.fn<DataSource["change"]>(async () => current);
    renderWith({ change, retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), " secreto ");
    await userEvent.click(retryButton());
    expect(await screen.findByText("Reintento en marcha (run 2).")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledWith("d1", "secreto");
    expect(change).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reintentar review" })).toBeNull();
  });

  it("forgets the token and says it is not valid on 401", async () => {
    const retry = vi.fn<DataSource["retry"]>().mockRejectedValue(new ApiError("x", 401));
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "malo");
    await userEvent.click(retryButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Token de ingesta no válido.");
    expect(tokenField()).toHaveValue("");
    expect(getIngestToken()).toBe("");
  });

  it("says it can no longer be retried on 409 and reloads the detail", async () => {
    const retry = vi.fn<DataSource["retry"]>().mockRejectedValue(new ApiError("x", 409));
    const change = vi.fn<DataSource["change"]>(async () => failed());
    renderWith({ change, retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "tok");
    await userEvent.click(retryButton());
    expect(await screen.findByText(/ya no se puede reintentar/)).toBeInTheDocument();
    await waitFor(() => expect(change).toHaveBeenCalledTimes(2));
  });

  it.each([
    [503, "El orquestador no está disponible"],
    [404, "Change no encontrado."],
    [null, "No se pudo conectar con el servidor."],
  ])("explains a %s failure and allows trying again", async (status, text) => {
    const retry = vi
      .fn<DataSource["retry"]>()
      .mockRejectedValueOnce(new ApiError("No se pudo conectar con el servidor.", status))
      .mockResolvedValue({ changeId: "d1", run: 2 });
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "tok");
    await userEvent.click(retryButton());
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(tokenField()).toHaveValue("tok");
    await userEvent.click(retryButton());
    expect(await screen.findByText("Reintento en marcha (run 2).")).toBeInTheDocument();
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it.each([
    [404, "Change no encontrado."],
    [503, "El orquestador no está disponible. Inténtalo de nuevo en unos minutos."],
    [401, "Token de ingesta no válido."],
    [500, "No se pudo reintentar: raw"],
  ])("shows the exact text of today for a %i (golden)", async (status, text) => {
    const retry = vi.fn<DataSource["retry"]>().mockRejectedValue(new ApiError("raw", status));
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "tok");
    await userEvent.click(retryButton());
    expect((await screen.findByRole("alert")).textContent).toBe(text);
  });

  it("marks, describes and focuses the token when it is missing", async () => {
    renderWith({ change: async () => failed() }, path);
    await screen.findByRole("heading", { name: "detalle" });
    expect(tokenField()).not.toHaveAttribute("aria-invalid");
    await userEvent.click(retryButton());
    const alert = await screen.findByRole("alert");
    expect(alert.id).not.toBe("");
    expect(tokenField()).toHaveAttribute("aria-invalid", "true");
    expect(tokenField()).toHaveAttribute("aria-describedby", alert.id);
    expect(tokenField()).toHaveFocus();
  });

  it("marks the emptied token and focuses it on 401", async () => {
    const retry = vi.fn<DataSource["retry"]>().mockRejectedValue(new ApiError("x", 401));
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "malo");
    await userEvent.click(retryButton());
    const alert = await screen.findByRole("alert");
    expect(tokenField()).toHaveValue("");
    expect(tokenField()).toHaveAttribute("aria-invalid", "true");
    expect(tokenField()).toHaveAttribute("aria-describedby", alert.id);
    expect(tokenField()).toHaveFocus();
  });

  it.each([503, 404, null])("marks no field on a %s failure", async (status) => {
    const retry = vi.fn<DataSource["retry"]>().mockRejectedValue(new ApiError("raw", status));
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "tok");
    await userEvent.click(retryButton());
    await screen.findByRole("alert");
    expect(document.querySelectorAll("[aria-invalid]")).toHaveLength(0);
    expect(tokenField()).not.toHaveAttribute("aria-describedby");
  });

  it("allows a single request at a time", async () => {
    let release: (value: { changeId: string; run: number }) => void = () => {};
    const retry = vi.fn<DataSource["retry"]>(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "tok");
    await userEvent.click(retryButton());
    const busy = await screen.findByRole("button", { name: "Reintentando…" });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(retry).toHaveBeenCalledTimes(1);
    release({ changeId: "d1", run: 2 });
    expect(await screen.findByText("Reintento en marcha (run 2).")).toBeInTheDocument();
  });

  it("keeps the token in memory only", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const retry = vi.fn<DataSource["retry"]>(async () => ({ changeId: "d1", run: 2 }));
    renderWith({ change: async () => failed(), retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    await userEvent.type(tokenField(), "secretisimo");
    await userEvent.click(retryButton());
    await screen.findByText("Reintento en marcha (run 2).");
    expect(setItem).not.toHaveBeenCalled();
    expect(`${JSON.stringify(localStorage)}${JSON.stringify(sessionStorage)}`).not.toContain(
      "secretisimo",
    );
    expect(document.body.textContent).not.toContain("secretisimo");
  });
});

describe("review metadata", () => {
  const detail = (reviews: ReturnType<typeof makeReview>[]) =>
    makeChange({ id: "d1", title: "detalle", reviews });

  it("shows run, duration and score on a completed review", async () => {
    renderWith(
      {
        change: async () =>
          detail([makeReview({ summary: "ok", run: 2, durationMs: 42_000, score: 8 })]),
      },
      "/p/demo/changes/d1",
    );
    const meta = await screen.findByRole("list", { name: "Datos de la review" });
    expect(within(meta).getByText("Run 2")).toBeInTheDocument();
    expect(within(meta).getByText("42 s")).toBeInTheDocument();
    expect(within(meta).getByText("Nota 8")).toBeInTheDocument();
  });

  it("omits the metadata list when the source has none", async () => {
    renderWith(
      { change: async () => detail([makeReview({ summary: "ok" })]) },
      "/p/demo/changes/d1",
    );
    await screen.findByText("ok");
    expect(screen.queryByRole("list", { name: "Datos de la review" })).toBeNull();
  });

  it("shows a sanitized failure reason as plain text", async () => {
    renderWith(
      {
        change: async () =>
          detail([
            makeReview({
              status: "failed",
              error: "boom token=abc123\u0000 <img src=x onerror=alert(1)>",
            }),
          ]),
      },
      "/p/demo/changes/d1",
    );
    const reason = await screen.findByText(/^Motivo:/);
    expect(reason).toHaveTextContent("boom token=[oculto]");
    expect(reason).not.toHaveTextContent("abc123");
    expect(reason.querySelector("img")).toBeNull();
  });

  it("does not show a reason for a review that did not fail", async () => {
    renderWith(
      { change: async () => detail([makeReview({ summary: "ok", error: "ignorado" })]) },
      "/p/demo/changes/d1",
    );
    await screen.findByText("ok");
    expect(screen.queryByText(/Motivo:/)).toBeNull();
  });
});

describe("change detail as a conversation", () => {
  const change = makeChange({
    id: "c1",
    title: "feat: paginar",
    run: 1,
    reviewStatus: "completed",
    diff: [
      "diff --git a/a.py b/a.py",
      "--- a/a.py",
      "+++ b/a.py",
      "@@ -1,1 +1,2 @@",
      " keep",
      "+new",
    ].join("\n"),
    reviews: [
      makeReview({
        id: "r2",
        agent: "agent_2",
        run: 1,
        summary: "Segunda opinión",
        findings: [makeFinding({ severity: "nit", file: "a.py", line: 2, message: "Renombra x" })],
      }),
      makeReview({
        id: "r1",
        agent: "agent_1",
        run: 1,
        summary: "Primera opinión",
        findings: [
          makeFinding({ severity: "bug", file: "a.py", line: 1, message: "Falta un caso" }),
        ],
      }),
    ],
  });

  it("shows each agent's review as a message from an app, in a stable order", async () => {
    renderWithAgents({ change: async () => change }, "/p/demo/changes/c1");
    const thread = (
      await screen.findByRole("heading", { name: "Revisión de los agentes" })
    ).closest("section") as HTMLElement;
    const messages = within(thread).getAllByRole("article");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveTextContent("Agent_1");
    expect(messages[1]).toHaveTextContent("Agent_2");
    for (const message of messages) expect(within(message).getByText("APP")).toBeInTheDocument();
  });

  it("lists each finding once: in the grouped panel, not repeated inside the messages", async () => {
    renderWithAgents({ change: async () => change }, "/p/demo/changes/c1");
    await screen.findByRole("heading", { name: "Hallazgos" });
    expect(screen.getAllByText(/Falta un caso/)).toHaveLength(1);
    expect(screen.getAllByText(/Renombra x/)).toHaveLength(1);
  });

  it("colors a finding's bar by severity: bug is red, risk amber, the rest neutral", async () => {
    const review = (severity: string) =>
      makeReview({
        agent: `a_${severity}`,
        run: 1,
        findings: [makeFinding({ severity, message: `m-${severity}`, file: `${severity}.py` })],
      });
    renderWithAgents(
      {
        change: async () => ({
          ...change,
          reviews: [review("bug"), review("risk"), review("nit")],
        }),
      },
      "/p/demo/changes/c1",
    );
    await screen.findByRole("heading", { name: "Hallazgos" });
    const tone = (severity: string) =>
      screen
        .getByText(new RegExp(`m-${severity}`))
        .closest("[data-level]")
        ?.getAttribute("data-level");
    expect(tone("bug")).toBe("danger");
    expect(tone("risk")).toBe("warning");
    expect(tone("nit")).toBe("neutral");
  });

  it("marks the file and hunk header rows of the diff so they can look like GitHub's", async () => {
    const { container } = renderWithAgents({ change: async () => change }, "/p/demo/changes/c1");
    await screen.findByRole("table", { name: "Diff" });
    expect(container.querySelectorAll("tr.diff-row.header.file")).toHaveLength(1);
    expect(container.querySelectorAll("tr.diff-row.header.hunk")).toHaveLength(1);
  });

  it("shows the five-square bar beside each file as decoration only", async () => {
    renderWithAgents({ change: async () => change }, "/p/demo/changes/c1");
    const nav = await screen.findByRole("navigation", { name: "Archivos del diff" });
    const squares = nav.querySelector(".squares");
    expect(squares).toHaveAttribute("aria-hidden", "true");
    expect(squares?.children).toHaveLength(5);
    expect(nav).toHaveTextContent("+1 −0");
  });

  it("shows the status as a pill with the state icon and its text", async () => {
    renderWithAgents({ change: async () => change }, "/p/demo/changes/c1");
    await screen.findByRole("heading", { name: "feat: paginar" });
    const pill = document.querySelector(".status-pill") as HTMLElement;
    expect(pill).toHaveAttribute("data-tone", "success");
    expect(within(pill).getByRole("img", { name: "Completada" })).toBeInTheDocument();
  });
});

describe("memoised detail", () => {
  const path = "/p/demo/changes/d1";
  const failed = (overrides: Partial<Change> = {}) =>
    makeChange({
      id: "d1",
      title: "detalle",
      reviewStatus: "failed",
      run: 1,
      diff: "@@ a.py\n+uno",
      reviews: [makeReview({ id: "r1", status: "failed" })],
      ...overrides,
    });
  const parseDiff = vi.mocked(diff.parseDiff);
  const panel = vi.mocked(findingsPanel.FindingsPanel);

  async function retryOnce() {
    await userEvent.type(screen.getByLabelText("Token de ingesta"), "tok");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar review" }));
  }

  it("parses the diff once and keeps the reviews while the data stays the same", async () => {
    const change = vi.fn<DataSource["change"]>(async () => failed());
    const retry = vi.fn<DataSource["retry"]>().mockRejectedValue(new ApiError("x", 409));
    renderWith({ change, retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    parseDiff.mockClear();
    panel.mockClear();

    await retryOnce();
    expect(await screen.findByText(/ya no se puede reintentar/)).toBeInTheDocument();
    await waitFor(() => expect(change).toHaveBeenCalledTimes(2));
    expect(parseDiff).not.toHaveBeenCalled();
    const received = panel.mock.calls.map(([props]) => props.reviews);
    expect(new Set(received).size).toBeLessThanOrEqual(1);
  });

  it("parses again when the diff changes", async () => {
    let current = failed();
    const retry = vi.fn<DataSource["retry"]>(async () => {
      current = failed({ reviewStatus: "pending", run: 2, reviews: [], diff: "@@ b.py\n+dos" });
      return { changeId: "d1", run: 2 };
    });
    renderWith({ change: async () => current, retry }, path);
    await screen.findByRole("heading", { name: "detalle" });
    parseDiff.mockClear();

    await retryOnce();
    expect(await screen.findByText("Pendiente")).toBeInTheDocument();
    expect(parseDiff).toHaveBeenCalledTimes(1);
    expect(parseDiff).toHaveBeenCalledWith("@@ b.py\n+dos");
  });
});

describe("silent reload after a retry", () => {
  const path = "/p/demo/changes/d1";
  const failed = makeChange({
    id: "d1",
    title: "detalle",
    reviewStatus: "failed",
    run: 1,
    diff: "@@ a.py\n+uno",
    reviews: [makeReview({ agent: "claude", status: "completed", summary: "resumen previo" })],
  });

  it.each([
    ["accepted (202)", async () => ({ changeId: "d1", run: 2 })],
    [
      "in conflict (409)",
      async () => {
        throw new ApiError("x", 409);
      },
    ],
  ] as const)("keeps the diff and the reviews on screen when %s", async (_, retry) => {
    let release: (change: Change) => void = () => {};
    const change = vi
      .fn<DataSource["change"]>()
      .mockResolvedValueOnce(failed)
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      );
    renderWith({ change, retry }, path);
    const table = await screen.findByRole("table", { name: "Diff" });
    await userEvent.type(screen.getByLabelText("Token de ingesta"), "tok");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar review" }));
    await waitFor(() => expect(change).toHaveBeenCalledTimes(2));

    expect(screen.queryByText("Cargando change…")).toBeNull();
    expect(screen.getByRole("table", { name: "Diff" })).toBe(table);
    expect(screen.getByText("resumen previo")).toBeInTheDocument();
    release(failed);
    await waitFor(() => expect(screen.getByRole("table", { name: "Diff" })).toBe(table));
  });
});

describe("retry note per change", () => {
  it("does not carry the note of change A over to change B", async () => {
    const a = makeChange({
      id: "a",
      title: "cambio A",
      kind: "commit",
      reviewStatus: "failed",
      run: 1,
      commitState: "reverted",
      revertedBy: { id: "b", sha: "bbbbbbb1234" },
      reviews: [makeReview({ status: "failed" })],
    });
    const b = makeChange({ id: "b", title: "cambio B", reviewStatus: "completed" });
    renderWith(
      {
        change: async (id) => (id === "a" ? a : b),
        retry: async () => ({ changeId: "a", run: 2 }),
      },
      "/p/demo/changes/a",
    );
    await screen.findByRole("heading", { name: "cambio A" });
    await userEvent.type(screen.getByLabelText("Token de ingesta"), "tok");
    await userEvent.click(screen.getByRole("button", { name: "Reintentar review" }));
    expect(await screen.findByText("Reintento en marcha (run 2).")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("link", { name: "bbbbbbb" }));
    expect(await screen.findByRole("heading", { name: "cambio B" })).toBeInTheDocument();
    expect(screen.queryByText("Reintento en marcha (run 2).")).toBeNull();
  });
});
