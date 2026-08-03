import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isValidRut, normalizeRut } from "../src/lib/rut.js";

describe("normalizeRut", () => {
  it("elimina puntos, guiones y espacios", () => {
    assert.equal(normalizeRut("61.502.000-1"), "61502000-1");
    assert.equal(normalizeRut(" 12.345.678-5 "), "12345678-5");
  });

  it("convierte k minúscula en K mayúscula", () => {
    assert.equal(normalizeRut("7.605.967-k"), "7605967-K");
  });

  it("inserta guion antes del dígito verificador", () => {
    assert.equal(normalizeRut("615020001"), "61502000-1");
  });

  it("devuelve texto corto sin guion", () => {
    assert.equal(normalizeRut("1"), "1");
    assert.equal(normalizeRut(""), "");
  });
});

describe("isValidRut", () => {
  it("acepta RUT válidos con y sin formato", () => {
    assert.equal(isValidRut("61.502.000-1"), true);
    assert.equal(isValidRut("61502000-1"), true);
    assert.equal(isValidRut("12.345.678-5"), true);
    assert.equal(isValidRut("11111111-1"), true);
  });

  it("rechaza dígito verificador incorrecto", () => {
    assert.equal(isValidRut("61.502.000-2"), false);
    assert.equal(isValidRut("12.345.678-9"), false);
  });

  it("rechaza cuerpos con longitud inválida", () => {
    assert.equal(isValidRut("123-4"), false);
    assert.equal(isValidRut("1234567890-1"), false);
  });

  it("rechaza vacíos y texto no numérico", () => {
    assert.equal(isValidRut(""), false);
    assert.equal(isValidRut("abc"), false);
    assert.equal(isValidRut("61.502.000-X"), false);
  });
});
