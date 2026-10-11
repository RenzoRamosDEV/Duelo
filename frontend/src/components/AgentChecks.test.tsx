import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeReview } from "../test/fixtures";
import { AgentChecks, agentStates } from "./AgentChecks";

const BOTH = ["claude", "codex"];

describe("AgentChecks", () => {
  it("shows Claude answered with a check and Codex still waiting without one", () => {
    render(
      <AgentChecks
        reviews={[makeReview({ agent: "claude", status: "completed" })]}
        run={1}
        expected={BOTH}
      />,
    );
    const claude = screen.getByRole("img", { name: "Claude: completada" });
    const codex = screen.getByRole("img", { name: "Codex: en espera" });
    expect(within(claude).getByText("✓")).toBeInTheDocument();
    expect(within(codex).queryByText("✓")).toBeNull();
    expect(within(codex).queryByText("✕")).toBeNull();
    expect(codex).toHaveAttribute("data-status", "waiting");
  });

  it("shows a cross for a failed agent, so the state is not only a color", () => {
    render(
      <AgentChecks
        reviews={[
          makeReview({ agent: "claude", status: "completed" }),
          makeReview({ agent: "codex", status: "failed" }),
        ]}
        run={1}
        expected={BOTH}
      />,
    );
    const codex = screen.getByRole("img", { name: "Codex: fallida" });
    expect(within(codex).getByText("✕")).toBeInTheDocument();
  });

  it("uses the agent's logo, or its initials when it has none", () => {
    const { container } = render(
      <AgentChecks
        reviews={[
          makeReview({ agent: "claude", status: "completed" }),
          makeReview({ agent: "agent_1", status: "completed" }),
        ]}
        run={1}
        expected={null}
      />,
    );
    expect(container.querySelector('[data-kind="logo"]')).not.toBeNull();
    expect(screen.getByRole("img", { name: "Agent_1: completada" })).toHaveTextContent("A1");
  });

  it("counts a review that is still running as waiting", () => {
    render(
      <AgentChecks
        reviews={[makeReview({ agent: "claude", status: "running" })]}
        run={1}
        expected={null}
      />,
    );
    expect(screen.getByRole("img", { name: "Claude: en espera" })).toBeInTheDocument();
  });

  it("puts every agent back to waiting in a new run", () => {
    render(
      <AgentChecks
        reviews={[
          makeReview({ agent: "claude", status: "completed", run: 1 }),
          makeReview({ agent: "codex", status: "completed", run: 1 }),
        ]}
        run={2}
        expected={BOTH}
      />,
    );
    expect(screen.getByRole("img", { name: "Claude: en espera" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Codex: en espera" })).toBeInTheDocument();
  });

  it("only lists the agents with a review while the expected ones are unknown", () => {
    render(
      <AgentChecks
        reviews={[makeReview({ agent: "codex", status: "completed" })]}
        run={1}
        expected={null}
      />,
    );
    expect(screen.getAllByRole("img")).toHaveLength(1);
    expect(screen.getByRole("img", { name: "Codex: completada" })).toBeInTheDocument();
  });

  it("renders nothing when there is no agent to show", () => {
    const { container } = render(<AgentChecks reviews={[]} run={1} expected={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps a stable alphabetical order whatever the order of the reviews", () => {
    const states = agentStates(
      [makeReview({ agent: "codex" }), makeReview({ agent: "claude" })],
      1,
      null,
    );
    expect(states.map((s) => s.agent)).toEqual(["claude", "codex"]);
  });
});
