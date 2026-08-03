import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const fetchMock = vi.fn<typeof fetch>();

const APP_ORIGIN = "http://localhost:3002";

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  process.env.INTERNAL_SERVICE_TOKEN = "test-internal-token-with-at-least-32-chars!!";
  process.env.BACKEND_INTERNAL_URL = "http://backend:4000";
  process.env.APP_BASE_URL = APP_ORIGIN;
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

function request(cookie?: string, headers?: HeadersInit) {
  return new NextRequest(`${APP_ORIGIN}/api/auth/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: APP_ORIGIN,
      "x-ghostinc-request": "1",
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
  });
}

function backendSession(status: number, payload?: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload ?? {}), { status }));
}

describe("POST /api/auth/session", () => {
  it("rechaza origen cruzado", async () => {
    const response = await POST(request("ghostinc_session=token", { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("responde 401 sin cookie de sesión", async () => {
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("devuelve el usuario sin rotar cuando el backend no renueva el token", async () => {
    backendSession(200, { user: { id: "u-1", email: "user@example.com", globalRole: "user", emailVerified: true } });
    const response = await POST(request("ghostinc_session=token-1"));

    expect(response.status).toBe(200);
    expect((await response.json()).user.email).toBe("user@example.com");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("rota la cookie cuando el backend entrega un token renovado", async () => {
    backendSession(200, {
      user: { id: "u-1", email: "user@example.com", globalRole: "user", emailVerified: true },
      token: "token-renovado",
    });
    const response = await POST(request("ghostinc_session=token-viejo"));

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("ghostinc_session=token-renovado");
  });

  it("limpia la cookie cuando el backend rechaza la sesión", async () => {
    backendSession(401, { error: "unauthorized" });
    const response = await POST(request("ghostinc_session=token-invalido"));

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
