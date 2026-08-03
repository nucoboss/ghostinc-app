import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as register } from "./route";
import { POST as recovery } from "../recovery/route";
import { POST as setPassword } from "../set-password/route";

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

function request(endpoint: string, body: unknown, headers?: HeadersInit) {
  return new NextRequest(`${APP_ORIGIN}${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_ORIGIN, "x-ghostinc-request": "1", ...headers },
    body: JSON.stringify(body),
  });
}

function backendResponse(status: number, payload?: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload ?? {}), { status }));
}

describe("BFF registro/recuperación/contraseña", () => {
  it("rechaza origen cruzado sin consultar el backend", async () => {
    const response = await register(request(
      "/api/auth/register",
      { email: "new@example.com" },
      { origin: "https://evil.example" },
    ));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza correos inválidos", async () => {
    for (const email of ["", "no-es-correo", "a@b", `${"x".repeat(255)}@example.com`]) {
      const response = await register(request("/api/auth/register", { email }));
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("register reenvía el correo al backend interno", async () => {
    backendResponse(200, { ok: true, message: "Revisa tu correo." });
    const response = await register(request("/api/auth/register", { email: "  New@Example.com  " }));

    expect(response.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/auth/register");
    expect(new Headers(options?.headers).get("x-internal-token")).toContain("test-internal-token");
    expect(JSON.parse(String(options?.body))).toEqual({ email: "New@Example.com" });
  });

  it("register traduce 429 y 502", async () => {
    backendResponse(429);
    expect((await register(request("/api/auth/register", { email: "new@example.com" }))).status).toBe(429);

    backendResponse(502, { error: "email_unavailable" });
    const unavailable = await register(request("/api/auth/register", { email: "new@example.com" }));
    expect(unavailable.status).toBe(502);
  });

  it("recovery reenvía al endpoint interno", async () => {
    backendResponse(200, { ok: true });
    const response = await recovery(request("/api/auth/recovery", { email: "lost@example.com" }));

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://backend:4000/internal/auth/recovery");
  });

  it("set-password reenvía token y contraseña", async () => {
    backendResponse(200, { ok: true });
    const response = await setPassword(request("/api/auth/set-password", { token: "tok-123", password: "correct horse battery staple" }));

    expect(response.status).toBe(200);
    expect(fetchMock.mock.calls[0]![0]).toBe("http://backend:4000/internal/auth/set-password");
  });

  it("set-password exige token y contraseña", async () => {
    for (const body of [{ token: "tok" }, { password: "pw" }, {}, { token: "", password: "" }]) {
      const response = await setPassword(request("/api/auth/set-password", body));
      expect(response.status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("set-password traduce invalid_password e invalid_token", async () => {
    backendResponse(400, { error: "invalid_password", detail: "La contraseña no cumple los requisitos." });
    const short = await setPassword(request("/api/auth/set-password", { token: "tok", password: "correct horse battery staple" }));
    expect(short.status).toBe(400);
    expect((await short.json()).error).toContain("no cumple los requisitos");

    backendResponse(400, { error: "invalid_token" });
    const stale = await setPassword(request("/api/auth/set-password", { token: "tok", password: "correct horse battery staple" }));
    expect(stale.status).toBe(400);
  });
});
