import "server-only";
import { cookies } from "next/headers";
import { backendCheckSession } from "./auth-backend";
import type { SessionUser } from "./auth-backend";
import { MFA_CHALLENGE_COOKIE, SESSION_COOKIE } from "./csrf";

export type { SessionUser } from "./auth-backend";

export function sessionCookieOptions(maxAgeSeconds = 0) {
  const secure = process.env.NODE_ENV === "production"
    || (process.env.APP_BASE_URL ?? "").startsWith("https://");
  return {
    httpOnly: true,
    sameSite: secure ? "strict" as const : "lax" as const,
    secure,
    path: "/",
    ...(maxAgeSeconds > 0 ? { maxAge: maxAgeSeconds } : {}),
  };
}

export async function getCurrentSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const result = await backendCheckSession(token, false);
    if (result.user.authLevel !== "full") return null;
    return result.user;
  } catch {
    return null;
  }
}

/** Indica si hay un desafío MFA pendiente tras el login. */
export async function hasPendingMfaChallenge(): Promise<boolean> {
  const cookieStore = await cookies();
  return Boolean(cookieStore.get(MFA_CHALLENGE_COOKIE)?.value);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}
