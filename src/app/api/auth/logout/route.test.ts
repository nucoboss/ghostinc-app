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
  return new NextRequest(`${APP_ORIGIN}/api/auth/logout`, {
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

describe("POST /api/auth/logout", () => {
  it("rechaza origen cruzado", async () => {
    const response = await POST(request(undefined, { origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sin sesión solo limpia la cookie y no llama al backend", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ghostinc_session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("revoca la sesión en el backend y limpia la cookie", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const response = await POST(request("ghostinc_session=session-token-abc"));

    expect(response.status).toBe(200);
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/auth/logout");
    expect(JSON.parse(String(options?.body))).toEqual({ token: "session-token-abc" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("conserva la cookie y avisa si el backend no puede revocar", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const response = await POST(request("ghostinc_session=session-token-abc"));
    expect(response.status).toBe(502);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
