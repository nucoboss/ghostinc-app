import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const fetchMock = vi.fn<typeof fetch>();

const APP_ORIGIN = "http://localhost:3002";

function authenticatedUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u-1",
    email: "user@example.com",
    globalRole: "user",
    emailVerified: true,
    authLevel: "full",
    mfaVerifiedAt: null,
    ...overrides,
  };
}

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

function request(body: unknown, headers?: HeadersInit) {
  return new NextRequest(`${APP_ORIGIN}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_ORIGIN, "x-ghostinc-request": "1", ...headers },
    body: JSON.stringify(body),
  });
}

function backendLoginResponse(status: number, payload?: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload ?? {}), { status }));
}

describe("POST /api/auth/login", () => {
  it("rechaza origen cruzado sin consultar el backend", async () => {
    const response = await POST(request(
      { email: "user@example.com", password: "correct horse battery staple" },
      { origin: "https://evil.example" },
    ));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("exige el header personalizado CSRF", async () => {
    const response = await POST(request(
      { email: "user@example.com", password: "correct horse battery staple" },
      { "x-ghostinc-request": "" },
    ));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza solicitudes sin señal de origen", async () => {
    const response = await POST(new NextRequest(`${APP_ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "user@example.com", password: "correct horse battery staple" }),
    }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza cuerpos inválidos", async () => {
    const response = await POST(request({ email: "no-es-un-correo", password: "x" }));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propaga credenciales inválidas y rate limit del backend", async () => {
    backendLoginResponse(401, { error: "invalid_credentials" });
    const unauthorized = await POST(request({ email: "user@example.com", password: "wrong-password-123" }));
    expect(unauthorized.status).toBe(401);
    expect((await unauthorized.json()).error).toBe("Credenciales inválidas.");

    backendLoginResponse(429);
    const limited = await POST(request({ email: "user@example.com", password: "correct horse battery staple" }));
    expect(limited.status).toBe(429);
  });

  it("configura la cookie opaca solo tras éxito", async () => {
    backendLoginResponse(200, {
      status: "authenticated",
      token: "opaque-token-value",
      user: authenticatedUser(),
    });
    const response = await POST(request({ email: "  User@Example.com ", password: "correct horse battery staple" }));

    expect(response.status).toBe(200);
    expect((await response.json()).user.email).toBe("user@example.com");

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/auth/login");
    expect(new Headers(options?.headers).get("x-internal-token")).toContain("test-internal-token");
    expect(JSON.parse(String(options?.body))).toEqual({ email: "User@Example.com", password: "correct horse battery staple" });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ghostinc_session=opaque-token-value");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=lax");
    expect(setCookie).toContain("Path=/");
    expect(setCookie).toContain("Max-Age=28800");
  });

  it("guarda el challenge MFA en su propia cookie y no abre la sesión", async () => {
    backendLoginResponse(200, {
      status: "mfa_required",
      token: "mfa-challenge-token",
      user: authenticatedUser({ authLevel: "mfa" }),
      mfaEnrollmentRequired: true,
    });
    const response = await POST(request({ email: "user@example.com", password: "correct horse battery staple" }));

    expect(response.status).toBe(200);
    expect((await response.json())).toMatchObject({
      status: "mfa_required",
      mfaEnrollmentRequired: true,
    });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ghostinc_mfa_challenge=mfa-challenge-token");
    expect(setCookie).toContain("ghostinc_session=;");
  });

  it("reenvía la IP confiable para separar el rate limit", async () => {
    backendLoginResponse(200, {
      status: "authenticated",
      token: "opaque-token-value",
      user: authenticatedUser(),
    });
    await POST(request(
      { email: "user@example.com", password: "correct horse battery staple" },
      { "x-forwarded-for": "203.0.113.42" },
    ));
    const options = fetchMock.mock.calls[0]![1];
    expect(new Headers(options?.headers).get("x-client-ip")).toBe("203.0.113.42");
  });

  it("no deja el token en el cuerpo de la respuesta ni en la URL", async () => {
    backendLoginResponse(200, {
      status: "authenticated",
      token: "opaque-token-value",
      user: authenticatedUser(),
    });
    const response = await POST(request({ email: "user@example.com", password: "correct horse battery staple" }));
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain("opaque-token-value");
  });

  it("responde 502 ante un backend no disponible", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await POST(request({ email: "user@example.com", password: "correct horse battery staple" }));
    expect(response.status).toBe(502);
  });
});
