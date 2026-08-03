import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { causaResponse } from "../../../../test/fixtures/causas";
import { POST } from "./route";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token-with-at-least-32-chars!!";
  process.env.BACKEND_INTERNAL_URL = "http://backend:4000";
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function request(body: unknown, headers?: HeadersInit) {
  return new NextRequest("http://localhost/api/causas", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/causas", () => {
  it("rechaza nombre inválido sin consultar el backend", async () => {
    const response = await POST(request({ kind: "company", query: "%%" }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("normaliza una empresa y envía el término solo en el body", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(causaResponse()), { status: 200 }));
    const response = await POST(request(
      { kind: "company", query: "  Empresa   Demo SPA " },
      { "cf-connecting-ip": "203.0.113.25", "x-forwarded-for": "198.51.100.10" },
    ));

    expect(response.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/v1/causas/search");
    expect(JSON.parse(String(options?.body))).toEqual({ kind: "company", query: "Empresa Demo SPA" });
    expect(new Headers(options?.headers).get("x-client-ip")).toBe("203.0.113.25");
    expect(String(url)).not.toContain("Empresa");
  });

  it("normaliza el RUT y no lo deja en la URL interna", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(causaResponse()), { status: 200 }));
    const response = await POST(request({ kind: "rut", query: "61.502.000-1" }));

    expect(response.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(String(url)).not.toContain("61502000-1");
    expect(JSON.parse(String(options?.body))).toEqual({ kind: "rut", query: "61502000-1" });
  });

  it("rechaza JSON exitoso que no cumple el contrato", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
    const response = await POST(request({ kind: "company", query: "Empresa Demo" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "El servicio de búsqueda devolvió una respuesta inválida." });
  });

  it("normaliza una respuesta no JSON del backend", async () => {
    fetchMock.mockResolvedValue(new Response("gateway error", { status: 502 }));
    const response = await POST(request({ kind: "company", query: "Empresa Demo" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "El servicio de búsqueda devolvió una respuesta inválida." });
  });
});
