import "server-only";

export type AdminUser = {
  id: string;
  email: string;
  global_role: "user" | "admin";
  blocked_at: string | null;
  email_verified_at: string | null;
  last_login_at: string | null;
  created_at: string;
  active_sessions: number;
};

function backendUrl() {
  return (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

function internalToken() {
  return process.env.INTERNAL_SERVICE_TOKEN;
}

async function adminRequest<T>(path: string, sessionToken: string, init?: RequestInit): Promise<T> {
  const token = internalToken();
  if (!token) throw new Error("INTERNAL_SERVICE_TOKEN is not configured.");
  const response = await fetch(`${backendUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Internal-Token": token,
      "X-Session-Token": sessionToken,
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Admin backend returned ${response.status}.`);
  return response.json() as Promise<T>;
}

export async function listAdminUsers(sessionToken: string): Promise<AdminUser[]> {
  const payload = await adminRequest<{ data: { users: AdminUser[] } }>("/internal/admin/users", sessionToken);
  return payload.data.users;
}

export async function adminUserAction(action: "block" | "unblock" | "role", userId: string, sessionToken: string, role?: "user" | "admin") {
  const path = action === "role"
    ? `/internal/admin/users/${encodeURIComponent(userId)}/role`
    : `/internal/admin/users/${encodeURIComponent(userId)}/${action}`;
  const body = action === "role"
    ? { token: sessionToken, role }
    : { token: sessionToken };
  await adminRequest<{ ok: boolean }>(path, sessionToken, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
