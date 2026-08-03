import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { auth0 } from "@/lib/auth0";
import { myAccountRequest } from "@/lib/my-account";

type TotpEnrollment = {
  id: string;
  auth_session: string;
  barcode_uri: string;
  manual_input_code: string;
};

export async function POST() {
  if (!await auth0?.getSession()) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const enrollment = await myAccountRequest<TotpEnrollment>("/authentication-methods", {
      method: "POST",
      body: JSON.stringify({ type: "totp" }),
    });
    const qrCode = await QRCode.toDataURL(enrollment.barcode_uri, { width: 280, margin: 1 });
    return NextResponse.json({
      id: enrollment.id,
      authSession: enrollment.auth_session,
      manualCode: enrollment.manual_input_code,
      qrCode,
    });
  } catch {
    return NextResponse.json({ error: "TOTP_ENROLLMENT_FAILED" }, { status: 502 });
  }
}
