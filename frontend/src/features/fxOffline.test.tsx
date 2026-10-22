// The effects' chunks are not precached: offline, the first time one is needed its import fails.
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { Beam } from "../components/fx/Beam";
import { HeroImage } from "../components/fx/HeroImage";
import { MetalButton } from "../components/fx/MetalButton";

const { offline } = vi.hoisted(() => ({
  offline: () => {
    throw new Error("Failed to fetch dynamically imported module");
  },
}));
vi.mock("../components/fx/HeroImageFx", offline);
vi.mock("../components/fx/MetalRing", offline);
vi.mock("../components/fx/BeamLayer", offline);
vi.mock("../components/FluidThemeSwitch", offline);
// jsdom has no WebGL; the effects that need it must be tried for their import to fail.
vi.mock("../components/fx/webgl", () => ({ hasWebGL: () => true }));

const settle = () => act(async () => await new Promise((resolve) => setTimeout(resolve, 0)));

describe("an effect whose code cannot be fetched", () => {
  it("leaves the hero as its plain picture", async () => {
    const { container } = render(<HeroImage src="/hero.webp" />);
    await settle();
    expect(container.querySelector("img.hero-img")).toHaveAttribute("src", "/hero.webp");
  });

  it("leaves the metal button as the plain button", async () => {
    render(<MetalButton>Añadir proyecto</MetalButton>);
    await settle();
    expect(screen.getByRole("button", { name: "Añadir proyecto" })).toBeInTheDocument();
  });

  it("leaves the beamed content without its beam", async () => {
    render(
      <Beam active>
        <p>en curso</p>
      </Beam>,
    );
    await settle();
    expect(screen.getByText("en curso")).toBeInTheDocument();
  });

  it("leaves the theme switch as the plain segmented control", async () => {
    render(<ThemeSwitch />);
    await settle();
    expect(screen.getByRole("group", { name: "Tema" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
