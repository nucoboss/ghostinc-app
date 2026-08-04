import "server-only";

export type SessionUser = {
  id: string;
  email: string;
  globalRole: "user" | "admin";
  emailVerified: boolean;
  authLevel: "password" | "mfa" | "full";
  mfaVerifiedAt: string | null;
};

type LoginResponse =
  | { status: "authenticated"; token: string; user: SessionUser }
  | { status: "mfa_required"; token: string; user: SessionUser; mfaEnrollmentRequired: boolean };
type SessionResponse = { user: SessionUser; token?: string };
type VerifyMfaResponse = { token: string; user: SessionUser };

function backendUrl() {
  return (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");
}

function internalToken() {
  return process.env.INTERNAL_SERVICE_TOKEN;
}

export class BackendAuthError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
    readonly detail?: unknown,
  ) {
    super(`Backend auth returned ${status}.`);
  }
}

async function authRequest<T>(
  path: string,
  body: unknown,
  timeoutMs = 5_000,
  clientIp?: string,
  sessionToken?: string,
): Promise<T> {
  const token = internalToken();
  if (!token) throw new Error("INTERNAL_SERVICE_TOKEN is not configured.");
  const response = await fetch(`${backendUrl()}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Internal-Token": token,
      ...(clientIp ? { "X-Client-IP": clientIp } : {}),
      ...(sessionToken ? { "X-Session-Token": sessionToken } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // sin cuerpo JSON
    }
    const code = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: unknown }).error
      : undefined;
    throw new BackendAuthError(response.status, typeof code === "string" ? code : undefined, payload);
  }
  return response.json() as Promise<T>;
}

export function backendLogin(email: string, password: string, clientIp?: string) {
  return authRequest<LoginResponse>("/internal/auth/login", { email, password }, 5_000, clientIp);
}

export function backendCheckSession(token: string, rotate: boolean) {
  const path = rotate ? "/internal/auth/session/rotate" : "/internal/auth/session";
  return authRequest<SessionResponse>(path, { token });
}

export function backendRequestToken(kind: "registration" | "recovery", email: string, clientIp?: string) {
  const path = kind === "registration" ? "/internal/auth/register" : "/internal/auth/recovery";
  return authRequest<{ ok: boolean; message: string }>(path, { email }, 10_000, clientIp);
}

export function backendSetPassword(token: string, password: string, clientIp?: string) {
  return authRequest<{ ok: boolean }>("/internal/auth/set-password", { token, password }, 5_000, clientIp);
}

export function backendLogout(token: string) {
  return authRequest<{ ok: boolean }>("/internal/auth/logout", { token });
}

export function backendVerifyMfa(token: string, code: string, clientIp?: string) {
  return authRequest<VerifyMfaResponse>("/internal/auth/mfa/verify", { token, code }, 5_000, clientIp);
}

export function backendMfaEnroll(token: string, clientIp?: string, password?: string) {
  return authRequest<{ secretBase32: string; uri: string }>(
    "/internal/auth/mfa/enroll",
    password ? { password } : {},
    5_000,
    clientIp,
    token,
  );
}

export function backendMfaConfirm(token: string, code: string, clientIp?: string) {
  return authRequest<{ recoveryCodes: string[] }>(
    "/internal/auth/mfa/confirm",
    { token, code },
    5_000,
    clientIp,
  );
}

export async function backendMfaStatus(token: string, clientIp?: string) {
  const response = await fetch(`${backendUrl()}/internal/auth/mfa/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Internal-Token": internalToken() ?? "",
      "X-Session-Token": token,
      ...(clientIp ? { "X-Client-IP": clientIp } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new BackendAuthError(response.status);
  return response.json() as Promise<{ enabled: boolean; recoveryCodesAvailable: number }>;
}

export function backendMfaRegenerate(token: string, clientIp?: string) {
  return authRequest<{ recoveryCodes: string[] }>(
    "/internal/auth/mfa/regenerate-codes",
    { token },
    5_000,
    clientIp,
  );
}

export function backendMfaDisable(token: string, password: string, clientIp?: string) {
  return authRequest<{ ok: boolean }>(
    "/internal/auth/mfa/disable",
    { token, password },
    5_000,
    clientIp,
  );
}
