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

function request(body: unknown, cookie?: string) {
  return new NextRequest(`${APP_ORIGIN}/api/auth/mfa`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: APP_ORIGIN,
      "x-ghostinc-request": "1",
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
}

function backendResponse(status: number, payload?: unknown) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload ?? {}), { status }));
}

describe("POST /api/auth/mfa", () => {
  it("rechaza sin cookie de desafío", async () => {
    const response = await POST(request({ code: "123456" }));
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rechaza códigos que no son de 6 dígitos", async () => {
    const response = await POST(request({ code: "abc" }, "ghostinc_mfa_challenge=challenge-token"));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("acepta el formato de código de recuperación", async () => {
    backendResponse(200, {
      token: "full-session-token",
      user: {
        id: "u-1",
        email: "user@example.com",
        globalRole: "user",
        emailVerified: true,
        authLevel: "full",
        mfaVerifiedAt: new Date().toISOString(),
      },
    });
    const recoveryCode = "Abcdefghijklmnopqrstuv";
    const response = await POST(request(
      { code: recoveryCode },
      "ghostinc_mfa_challenge=challenge-token",
    ));
    expect(response.status).toBe(200);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({
      token: "challenge-token",
      code: recoveryCode,
    });
  });

  it("rota el challenge a sesión completa y limpia la cookie de desafío", async () => {
    backendResponse(200, {
      token: "full-session-token",
      user: {
        id: "u-1",
        email: "user@example.com",
        globalRole: "user",
        emailVerified: true,
        authLevel: "full",
        mfaVerifiedAt: new Date().toISOString(),
      },
    });
    const response = await POST(request({ code: "123456" }, "ghostinc_mfa_challenge=challenge-token"));

    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe("authenticated");

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/auth/mfa/verify");
    expect(JSON.parse(String(options?.body))).toEqual({ token: "challenge-token", code: "123456" });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("ghostinc_session=full-session-token");
    expect(setCookie).toContain("ghostinc_mfa_challenge=;");
  });

  it("no reenvía códigos de desafío a la URL", async () => {
    backendResponse(200, {
      token: "full-session-token",
      user: {
        id: "u-1",
        email: "user@example.com",
        globalRole: "user",
        emailVerified: true,
        authLevel: "full",
        mfaVerifiedAt: new Date().toISOString(),
      },
    });
    const response = await POST(request({ code: "123456" }, "ghostinc_mfa_challenge=challenge-token"));
    expect(response.status).toBe(200);
    expect(response.url).not.toContain("123456");
    expect(response.url).not.toContain("challenge-token");
  });
});
