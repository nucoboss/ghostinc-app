import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import {
  BackendAuthError,
  backendMfaDisable,
  backendMfaEnroll,
  backendMfaStatus,
} from "@/lib/auth-backend";
import { MFA_CHALLENGE_COOKIE, SESSION_COOKIE, isSameOriginRequest } from "@/lib/csrf";
import { clientIp } from "@/lib/client-ip";
import { sessionCookieOptions } from "@/lib/session";

export const dynamic = "force-dynamic";

function sessionToken(request: NextRequest) {
  return request.cookies.get(MFA_CHALLENGE_COOKIE)?.value
    ?? request.cookies.get(SESSION_COOKIE)?.value;
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    return NextResponse.json(await backendMfaStatus(token, clientIp(request)));
  } catch (error) {
    if (error instanceof BackendAuthError && error.status === 401) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    return NextResponse.json({ error: "TOTP_STATUS_FAILED" }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }
  const token = sessionToken(request);
  if (!token) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : undefined;
  const isMfaEnrollment = Boolean(request.cookies.get(MFA_CHALLENGE_COOKIE)?.value);
  if (!isMfaEnrollment && !password) {
    return NextResponse.json({ error: "PASSWORD_REQUIRED" }, { status: 400 });
  }
  if (password && password.length > 128) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    const enrollment = await backendMfaEnroll(token, clientIp(request), password);
    const qrCode = await QRCode.toDataURL(enrollment.uri, { width: 280, margin: 1 });
    return NextResponse.json({
      secretBase32: enrollment.secretBase32,
      manualCode: enrollment.secretBase32,
      qrCode,
    });
  } catch (error) {
    if (error instanceof BackendAuthError && error.status === 401) {
      return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
    }
    if (error instanceof BackendAuthError && error.status === 409) {
      return NextResponse.json({ error: "TOTP_ALREADY_ENABLED" }, { status: 409 });
    }
    return NextResponse.json({ error: "TOTP_ENROLLMENT_FAILED" }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || password.length > 128) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    await backendMfaDisable(token, password, clientIp(request));
    const response = NextResponse.json({ disabled: true });
    response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) {
    if (error instanceof BackendAuthError) {
      if (error.status === 401) {
        return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
      }
      if (error.status === 403) {
        return NextResponse.json({ error: "ADMIN_MFA_REQUIRED" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "TOTP_DISABLE_FAILED" }, { status: 502 });
  }
}
