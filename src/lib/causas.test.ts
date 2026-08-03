import { describe, expect, it } from "vitest";
import { causaResponse } from "../../test/fixtures/causas";
import { isCausaSearchResponse } from "./causas";

describe("isCausaSearchResponse", () => {
  it("acepta el contrato completo", () => {
    expect(isCausaSearchResponse(causaResponse())).toBe(true);
  });

  it("rechaza resúmenes parciales", () => {
    expect(isCausaSearchResponse({ data: { summary: { total: 1 }, causas: [] } })).toBe(false);
  });

  it("rechaza causas con identificador de tipo incorrecto", () => {
    const response = causaResponse();
    const malformed = { ...response, data: { ...response.data, causas: [{ ...response.data.causas[0], id: "1" }] } };
    expect(isCausaSearchResponse(malformed)).toBe(false);
  });
});
