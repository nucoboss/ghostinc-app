import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { myAccountRequest } from "@/lib/my-account";

export async function POST(request: Request) {
  if (!await auth0?.getSession()) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  const body = await request.json().catch(() => null) as { id?: unknown; authSession?: unknown; otpCode?: unknown } | null;
  if (!body || typeof body.id !== "string" || typeof body.authSession !== "string" || typeof body.otpCode !== "string" || !/^\d{6}$/.test(body.otpCode)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  try {
    await myAccountRequest(`/authentication-methods/${encodeURIComponent(body.id)}/verify`, {
      method: "POST",
      body: JSON.stringify({ auth_session: body.authSession, otp_code: body.otpCode }),
    });
    return NextResponse.json({ verified: true });
  } catch {
    return NextResponse.json({ error: "INVALID_OTP" }, { status: 400 });
  }
}
