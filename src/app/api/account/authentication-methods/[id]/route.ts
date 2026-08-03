import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin-auth";
import { auth0 } from "@/lib/auth0";
import { myAccountRequest } from "@/lib/my-account";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth0?.getSession();
  if (!session) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (await isAdminUser(session.user)) return NextResponse.json({ error: "ADMIN_MFA_REQUIRED" }, { status: 403 });
  const { id } = await params;
  try {
    await myAccountRequest(`/authentication-methods/${encodeURIComponent(id)}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "MFA_DELETE_FAILED" }, { status: 502 });
  }
}
