import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function POST() {
  const session = await auth0?.getSession();
  const email = session?.user.email;
  const domain = process.env.AUTH0_DOMAIN?.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const clientId = process.env.AUTH0_CLIENT_ID;
  const connection = process.env.AUTH0_DATABASE_CONNECTION ?? "Username-Password-Authentication";
  if (!session || typeof email !== "string" || !domain || !clientId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    await fetch(`https://${domain}/dbconnections/change_password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId, email, connection }),
      signal: AbortSignal.timeout(8_000),
    });
    return NextResponse.json({ sent: true });
  } catch {
    return NextResponse.json({ error: "PASSWORD_RESET_FAILED" }, { status: 502 });
  }
}
