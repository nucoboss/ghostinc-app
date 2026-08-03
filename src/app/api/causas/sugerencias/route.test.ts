import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
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

function request(query: string) {
  return new NextRequest("http://localhost/api/causas/sugerencias", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

describe("POST /api/causas/sugerencias", () => {
  it("normaliza la consulta y valida sugerencias", async () => {
    const payload = { data: [{ nombre: "EMPRESA DEMO SPA", rut: "76123456-7", causas: 12 }] };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const response = await POST(request(" Empresa   Demo "));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(payload);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({ query: "Empresa Demo" });
  });

  it("rechaza nombres cortos sin llamar al backend", async () => {
    const response = await POST(request("ab"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza payload upstream malformado", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [{ nombre: "x" }] }), { status: 200 }));
    const response = await POST(request("Empresa"));
    expect(response.status).toBe(502);
  });
});
