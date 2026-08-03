import { describe, expect, it } from "vitest";
import { isValidRut, normalizeRut } from "./rut";

describe("normalizeRut", () => {
  it("elimina puntos, guiones y espacios", () => {
    expect(normalizeRut("61.502.000-1")).toBe("61502000-1");
    expect(normalizeRut(" 12.345.678-5 ")).toBe("12345678-5");
  });

  it("convierte k minúscula en K mayúscula", () => {
    expect(normalizeRut("7.605.967-k")).toBe("7605967-K");
  });

  it("inserta guion antes del dígito verificador", () => {
    expect(normalizeRut("615020001")).toBe("61502000-1");
  });
});

describe("isValidRut", () => {
  it("acepta RUT válidos con y sin formato", () => {
    expect(isValidRut("61.502.000-1")).toBe(true);
    expect(isValidRut("12.345.678-5")).toBe(true);
    expect(isValidRut("11111111-1")).toBe(true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    expect(isValidRut("61.502.000-2")).toBe(false);
    expect(isValidRut("12.345.678-9")).toBe(false);
  });

  it("rechaza cuerpos con longitud inválida y vacíos", () => {
    expect(isValidRut("123-4")).toBe(false);
    expect(isValidRut("")).toBe(false);
    expect(isValidRut("abc")).toBe(false);
  });
});
