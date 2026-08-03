import { NextRequest, NextResponse } from "next/server";
import { BackendAuthError, backendRequestToken } from "@/lib/auth-backend";
import { isSameOriginRequest } from "@/lib/csrf";
import { clientIp } from "@/lib/client-ip";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseEmail(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "email")) return null;
  if (typeof body.email !== "string") return null;
  const email = body.email.trim();
  if (email.length < 3 || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
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

  const email = parseEmail(rawBody);
  if (!email) {
    return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
  }

  try {
    const result = await backendRequestToken("recovery", email, clientIp(request));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BackendAuthError) {
      if (error.status === 429) {
        return NextResponse.json({ error: "Demasiadas solicitudes. Espera un minuto." }, { status: 429 });
      }
      if (error.status === 502) {
        return NextResponse.json({ error: "No fue posible completar la solicitud. Intenta nuevamente." }, { status: 502 });
      }
    }
    return NextResponse.json({ error: "No fue posible completar la solicitud. Intenta nuevamente." }, { status: 502 });
  }
}
