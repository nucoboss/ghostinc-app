import { NextRequest, NextResponse } from "next/server";
import { BackendAuthError, backendVerifyMfa } from "@/lib/auth-backend";
import {
  MFA_CHALLENGE_COOKIE,
  SESSION_ABSOLUTE_SECONDS,
  SESSION_COOKIE,
  isSameOriginRequest,
} from "@/lib/csrf";
import { sessionCookieOptions } from "@/lib/session";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  const challengeToken = request.cookies.get(MFA_CHALLENGE_COOKIE)?.value;
  if (!challengeToken) {
    return NextResponse.json({ error: "Sesión no válida." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code) && !/^[A-Za-z0-9_-]{20,64}$/.test(code)) {
    return NextResponse.json({ error: "Ingresa un código TOTP o de recuperación válido." }, { status: 400 });
  }

  try {
    const result = await backendVerifyMfa(challengeToken, code, clientIp(request));
    const response = NextResponse.json({ status: "authenticated", user: result.user });
    response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(SESSION_ABSOLUTE_SECONDS));
    response.cookies.set(MFA_CHALLENGE_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof BackendAuthError) {
      if (error.status === 429) {
        return NextResponse.json({ error: "Demasiados intentos. Espera un minuto." }, { status: 429 });
      }
      if (error.status === 401 || error.status === 400) {
        return NextResponse.json(
          { error: "Código inválido. Vuelve a intentarlo." },
          { status: 401 },
        );
      }
    }
    return NextResponse.json({ error: "El servicio de acceso no está disponible." }, { status: 502 });
  }
}
