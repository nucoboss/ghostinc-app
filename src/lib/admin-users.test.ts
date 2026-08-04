import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { inviteAdminUser } from "./admin-users";

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

describe("inviteAdminUser", () => {
  it("envía la invitación con token interno y sesión admin", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await inviteAdminUser("invited@example.com", "admin-session-token");

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://backend:4000/internal/admin/users/invite");
    expect(new Headers(init?.headers).get("x-internal-token")).toBe(
      "test-internal-token-with-at-least-32-chars!!",
    );
    expect(new Headers(init?.headers).get("x-session-token")).toBe("admin-session-token");
    expect(JSON.parse(String(init?.body))).toEqual({
      token: "admin-session-token",
      email: "invited@example.com",
    });
  });
});
