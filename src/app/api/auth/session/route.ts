import { NextRequest, NextResponse } from "next/server";
import { BackendAuthError, backendCheckSession } from "@/lib/auth-backend";
import { SESSION_ABSOLUTE_SECONDS, SESSION_COOKIE, isSameOriginRequest } from "@/lib/csrf";
import { sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await backendCheckSession(token, true);
    if (result.user.authLevel === "mfa") {
      const response = NextResponse.json({ error: "mfa_required" }, { status: 401 });
      response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
      return response;
    }
    const response = NextResponse.json({ user: result.user });
    if (result.token) {
      response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(SESSION_ABSOLUTE_SECONDS));
    }
    return response;
  } catch (error) {
    if (error instanceof BackendAuthError && error.status === 401) {
      const response = NextResponse.json({ error: "unauthorized" }, { status: 401 });
      response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
      return response;
    }
    return NextResponse.json({ error: "El servicio de acceso no está disponible." }, { status: 502 });
  }
}
