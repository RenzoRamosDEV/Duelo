import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { apiErrorMessage } from "./apiErrorMessage";

const overrides = { 404: "No existe.", 503: "Caído." };

describe("apiErrorMessage", () => {
  it.each([new Error("boom"), "boom", null, undefined])(
    "hides anything that is not an ApiError (%j)",
    (error) => expect(apiErrorMessage(error, overrides, "x")).toBe("Ocurrió un error inesperado."),
  );

  it("uses the network message when there is no status", () => {
    const error = new ApiError("No se pudo conectar con el servidor.", null);
    expect(apiErrorMessage(error, overrides, "x")).toBe("No se pudo conectar con el servidor.");
  });

  it.each([
    [404, "No existe."],
    [503, "Caído."],
  ])("uses the override for %i", (status, text) =>
    expect(apiErrorMessage(new ApiError("raw", status), overrides, "x")).toBe(text),
  );

  it("says the token is not valid on 401 by default", () =>
    expect(apiErrorMessage(new ApiError("raw", 401), overrides, "x")).toBe(
      "Token de ingesta no válido.",
    ));

  it("lets an override replace the 401 text", () =>
    expect(apiErrorMessage(new ApiError("raw", 401), { 401: "Otro." }, "x")).toBe("Otro."));

  it.each([400, 500, 502])("names the action and the server message for %i", (status) =>
    expect(apiErrorMessage(new ApiError("falló", status), overrides, "reintentar")).toBe(
      "No se pudo reintentar: falló",
    ),
  );

  it("works without overrides", () => {
    expect(apiErrorMessage(new ApiError("falló", 404), {}, "quitar")).toBe(
      "No se pudo quitar: falló",
    );
    expect(apiErrorMessage(new ApiError("raw", 401), {}, "quitar")).toBe(
      "Token de ingesta no válido.",
    );
  });
});
