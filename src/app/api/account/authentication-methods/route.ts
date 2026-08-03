import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { type AuthenticationMethod, myAccountRequest } from "@/lib/my-account";

export async function GET() {
  if (!await auth0?.getSession()) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  try {
    const methods = await myAccountRequest<AuthenticationMethod[]>("/authentication-methods");
    return NextResponse.json({ methods });
  } catch {
    return NextResponse.json({ error: "REAUTHENTICATION_REQUIRED" }, { status: 401 });
  }
}
