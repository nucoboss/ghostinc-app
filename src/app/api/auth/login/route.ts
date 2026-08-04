import { NextRequest, NextResponse } from "next/server";
import { BackendAuthError, backendLogin } from "@/lib/auth-backend";
import {
  MFA_CHALLENGE_COOKIE,
  SESSION_ABSOLUTE_SECONDS,
  SESSION_COOKIE,
  isSameOriginRequest,
} from "@/lib/csrf";
import { sessionCookieOptions } from "@/lib/session";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

type LoginBody = { email: string; password: string };

function parseBody(value: unknown): LoginBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "email" && key !== "password")) return null;
  if (typeof body.email !== "string" || typeof body.password !== "string") return null;
  const email = body.email.trim();
  if (email.length < 3 || email.length > 254 || !email.includes("@")) return null;
  if (body.password.length < 1 || body.password.length > 128) return null;
  return { email, password: body.password };
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Ingresa tu correo y contraseña." }, { status: 400 });
  }

  try {
    const result = await backendLogin(body.email, body.password, clientIp(request));
    if (result.status === "mfa_required") {
      const response = NextResponse.json({
        status: "mfa_required",
        user: result.user,
        mfaEnrollmentRequired: result.mfaEnrollmentRequired,
      });
      response.cookies.set(
        MFA_CHALLENGE_COOKIE,
        result.token,
        sessionCookieOptions(SESSION_ABSOLUTE_SECONDS),
      );
      response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
      return response;
    }
    const response = NextResponse.json({ status: "authenticated", user: result.user });
    response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(SESSION_ABSOLUTE_SECONDS));
    return response;
  } catch (error) {
    if (error instanceof BackendAuthError) {
      if (error.status === 429) {
        return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
      }
      if (error.status === 401) {
        return NextResponse.json({ error: "Credenciales inválidas." }, { status: 401 });
      }
    }
    return NextResponse.json({ error: "El servicio de acceso no está disponible." }, { status: 502 });
  }
}
