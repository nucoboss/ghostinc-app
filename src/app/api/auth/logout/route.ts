import { NextRequest, NextResponse } from "next/server";
import { backendLogout } from "@/lib/auth-backend";
import { SESSION_COOKIE, isSameOriginRequest } from "@/lib/csrf";
import { sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await backendLogout(token);
    } catch {
      return NextResponse.json(
        { error: "No fue posible revocar la sesión. Intenta nuevamente." },
        { status: 502 },
      );
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
