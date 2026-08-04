import { NextRequest, NextResponse } from "next/server";
import { BackendAuthError, backendMfaConfirm } from "@/lib/auth-backend";
import { MFA_CHALLENGE_COOKIE, SESSION_COOKIE, isSameOriginRequest } from "@/lib/csrf";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }
  const sessionToken = request.cookies.get(MFA_CHALLENGE_COOKIE)?.value
    ?? request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    const result = await backendMfaConfirm(sessionToken, code, clientIp(request));
    return NextResponse.json({ verified: true, recoveryCodes: result.recoveryCodes });
  } catch (error) {
    if (error instanceof BackendAuthError && error.status === 400) {
      return NextResponse.json({ error: "INVALID_OTP" }, { status: 400 });
    }
    return NextResponse.json({ error: "TOTP_CONFIRMATION_FAILED" }, { status: 502 });
  }
}
