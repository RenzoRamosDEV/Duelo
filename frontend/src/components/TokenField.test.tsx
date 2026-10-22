import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { clearIngestToken, getIngestToken } from "../lib/ingestToken";
import { TokenField } from "./TokenField";

beforeEach(clearIngestToken);

describe("TokenField", () => {
  it("is a labelled password input that browsers do not autofill", () => {
    render(<TokenField id="tok" />);
    const input = screen.getByLabelText("Token de ingesta");
    expect(input).toHaveAttribute("id", "tok");
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("writes what the user types to the in-memory token", async () => {
    render(<TokenField id="tok" />);
    await userEvent.type(screen.getByLabelText("Token de ingesta"), "secreto");
    expect(getIngestToken()).toBe("secreto");
  });

  it("is not marked invalid nor described without an error", () => {
    render(<TokenField id="tok" />);
    const input = screen.getByLabelText("Token de ingesta");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("is marked invalid and described by the error it is given", () => {
    render(<TokenField id="tok" errorId="err" />);
    const input = screen.getByLabelText("Token de ingesta");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "err");
  });

  it("hands its input to the ref", () => {
    const ref = createRef<HTMLInputElement>();
    render(<TokenField id="tok" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText("Token de ingesta"));
  });
});
