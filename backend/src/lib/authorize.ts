import type { FastifyRequest } from "fastify";
import { checkSession, sessionHasRecentMfa } from "../services/auth-sessions.js";
import type { SessionUser } from "../services/auth-sessions.js";

class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}

export function sessionTokenFromRequest(request: FastifyRequest): string {
  const header = request.headers["x-session-token"];
  return typeof header === "string" ? header : "";
}

/** Devuelve el usuario canónico de la sesión; nunca acepta identidades por parámetros. */
export async function requireSessionUser(token: string): Promise<SessionUser> {
  const session = await checkSession(token);
  if (session.kind !== "ok" || session.user.authLevel !== "full") {
    throw new AuthError("AUTH_REQUIRED", 401);
  }
  return session.user;
}

/** Exige sesión de administrador con MFA reciente para operaciones privilegiadas. */
export async function requireAdminActor(token: string): Promise<SessionUser> {
  const session = await checkSession(token);
  if (session.kind !== "ok" || session.user.globalRole !== "admin" || !sessionHasRecentMfa(session.user)) {
    throw new AuthError("ADMIN_ACTOR_MFA_REQUIRED", 403);
  }
  return session.user;
}

export { AuthError };
