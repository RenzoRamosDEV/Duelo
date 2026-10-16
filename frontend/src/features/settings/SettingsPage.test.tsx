// The settings page mounted inside the whole app, over a fake data source.
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Health } from "../../data/types";
import { ApiError, type DataSource } from "../../lib/api";
import { resetThemeForTests } from "../../lib/theme";
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

const renderWithAgents = (source: Partial<DataSource>, path: string) =>
  renderApp(path, { ...AGENTS, ...source }, { now: NOW });

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  resetThemeForTests();
});

afterEach(() => vi.restoreAllMocks());

describe("settings diagnostics", () => {
  const projectsSection = () => screen.getByRole("region", { name: "Proyectos vigilados" });
  const diagnosticsSection = () => screen.getByRole("region", { name: "Diagnóstico" });

  const health = (overrides: Partial<Health> = {}): Health => ({
    status: "ok",
    dependencies: [
      { name: "postgres", status: "ok", latencyMs: 4 },
      { name: "temporal", status: "ok", latencyMs: 12 },
    ],
    agentNames: ["claude", "codex"],
    ...overrides,
  });

  it("lists the projects and each dependency with its latency", async () => {
    renderWith(
      {
        projects: async () => [
          { slug: "acme/widgets", name: "acme/widgets" },
          { slug: "demo", name: "demo" },
        ],
        health: async () => health(),
      },
      "/settings",
    );
    expect(await within(projectsSection()).findByText("acme/widgets")).toBeInTheDocument();
    expect(within(projectsSection()).getByText("demo")).toBeInTheDocument();
    expect(await screen.findByText("Correcto")).toBeInTheDocument();
    expect(screen.getByText("Postgres").closest(".setting")).toHaveTextContent("4 ms");
    expect(screen.getByText("Temporal").closest(".setting")).toHaveTextContent("12 ms");
  });

  it("shows a degraded server and the translated reason, never free text", async () => {
    renderWith(
      {
        health: async () =>
          health({
            status: "degraded",
            dependencies: [
              { name: "postgres", status: "ok", latencyMs: 4 },
              { name: "temporal", status: "unavailable", latencyMs: 2000, reason: "timeout" },
            ],
          }),
      },
      "/settings",
    );
    expect(await screen.findByText("Degradado")).toBeInTheDocument();
    const temporal = screen.getByText("Temporal").closest(".setting");
    expect(temporal).toHaveTextContent("No disponible");
    expect(temporal).toHaveTextContent("Tiempo agotado");
    expect(temporal).toHaveTextContent("2000 ms");
  });

  it("keeps the projects visible when only the diagnostics fail, and refreshes them", async () => {
    const healthCall = vi
      .fn<DataSource["health"]>()
      .mockRejectedValueOnce(new ApiError("El servidor respondió 500.", 500))
      .mockResolvedValue(health());
    renderWith({ health: healthCall }, "/settings");
    expect(await within(diagnosticsSection()).findByRole("alert")).toHaveTextContent("500");
    expect(await within(projectsSection()).findByText("demo")).toBeInTheDocument();
    await userEvent.click(within(diagnosticsSection()).getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Correcto")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(healthCall).toHaveBeenCalledTimes(3));
  });

  it("keeps the diagnostics visible when only the projects fail", async () => {
    renderWith(
      {
        projects: async () => {
          throw new ApiError("El servidor respondió 500.", 500);
        },
        health: async () => health(),
      },
      "/settings",
    );
    expect(await screen.findByText("Correcto")).toBeInTheDocument();
    expect(within(projectsSection()).getByRole("alert")).toHaveTextContent("500");
    expect(within(diagnosticsSection()).queryByRole("alert")).toBeNull();
  });
});

describe("settings: appearance", () => {
  it("has an Appearance box where the theme can be changed and is remembered", async () => {
    renderWithAgents({}, "/settings");
    const box = within(
      (await screen.findByRole("heading", { name: "Apariencia" })).closest(
        "section",
      ) as HTMLElement,
    );
    await userEvent.click(box.getByRole("button", { name: "Oscuro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(localStorage.getItem("duelo-theme")).toBe("dark");
    await userEvent.click(box.getByRole("button", { name: "Claro" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("the header switch and the Settings one stay in step", async () => {
    renderWithAgents({}, "/settings");
    await screen.findByRole("heading", { name: "Apariencia" });
    await userEvent.click(screen.getByRole("button", { name: "Tema claro" }));
    expect(screen.getByRole("button", { name: "Claro" })).toHaveAttribute("aria-pressed", "true");
  });
});
