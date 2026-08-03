import { NextRequest, NextResponse } from "next/server";
import { BackendAuthError, backendSetPassword } from "@/lib/auth-backend";
import { isSameOriginRequest } from "@/lib/csrf";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

function parseBody(value: unknown): { token: string; password: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "token" && key !== "password")) return null;
  if (typeof body.token !== "string" || typeof body.password !== "string") return null;
  if (body.token.length < 1 || body.token.length > 128) return null;
  if (body.password.length < 12 || body.password.length > 128) return null;
  return { token: body.token, password: body.password };
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 12 caracteres." }, { status: 400 });
  }

  try {
    const result = await backendSetPassword(body.token, body.password, clientIp(request));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BackendAuthError && error.status === 400) {
      const message = error.code === "invalid_password"
        ? "La contraseña no cumple los requisitos."
        : "El enlace no es válido o ya fue usado.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "No fue posible completar la solicitud. Intenta nuevamente." }, { status: 502 });
  }
}
