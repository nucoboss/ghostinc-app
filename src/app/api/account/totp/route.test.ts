import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE, GET, POST } from "./route";

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

function request(cookie: string, method: "GET" | "POST" | "DELETE" = "POST", body?: unknown) {
  return new NextRequest(`${APP_ORIGIN}/api/account/totp`, {
    method,
    headers: {
      origin: APP_ORIGIN,
      "x-ghostinc-request": "1",
      cookie,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

describe("POST /api/account/totp", () => {
  it("usa la cookie de challenge y la reenvía como X-Session-Token", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      secretBase32: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/Ghostinc:user@example.com?secret=JBSWY3DPEHPK3PXP",
    }), { status: 200 }));

    const response = await POST(request(
      "ghostinc_session=revoked-token; ghostinc_mfa_challenge=challenge-token",
    ));
    expect(response.status).toBe(200);

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/auth/mfa/enroll");
    expect(new Headers(options?.headers).get("x-session-token")).toBe("challenge-token");
  });

  it("reenvía la contraseña para reautenticar a un usuario común", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      secretBase32: "JBSWY3DPEHPK3PXP",
      uri: "otpauth://totp/Ghostinc:user@example.com?secret=JBSWY3DPEHPK3PXP",
    }), { status: 200 }));

    const response = await POST(request(
      "ghostinc_session=session-token",
      "POST",
      { password: "correct horse battery staple" },
    ));
    expect(response.status).toBe(200);
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body).toEqual({ password: "correct horse battery staple" });
  });

  it("rechaza una sesión normal sin contraseña antes de llamar al backend", async () => {
    const response = await POST(request("ghostinc_session=session-token"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/account/totp", () => {
  it("consulta el estado con la sesión opaca", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      enabled: true,
      recoveryCodesAvailable: 8,
    }), { status: 200 }));

    const response = await GET(request("ghostinc_session=session-token", "GET"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enabled: true, recoveryCodesAvailable: 8 });
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get("x-session-token")).toBe("session-token");
  });
});

describe("DELETE /api/account/totp", () => {
  it("exige contraseña y la reenvía al backend", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const response = await DELETE(request(
      "ghostinc_session=session-token",
      "DELETE",
      { password: "correct horse battery staple" },
    ));
    expect(response.status).toBe(200);
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body));
    expect(body).toEqual({ token: "session-token", password: "correct horse battery staple" });
  });

  it("rechaza la baja sin contraseña antes de llamar al backend", async () => {
    const response = await DELETE(request("ghostinc_session=session-token", "DELETE", {}));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
