import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { isCompanySuggestionsResponse } from "@/lib/causas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Nombre de empresa inválido." }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== "query") || typeof record.query !== "string") {
    return NextResponse.json({ error: "Nombre de empresa inválido." }, { status: 400 });
  }
  const query = record.query.trim().replace(/\s+/g, " ");
  if (query.length < 3 || query.length > 120 || !/[\p{L}\p{N}]/u.test(query)) {
    return NextResponse.json({ error: "Nombre de empresa inválido." }, { status: 400 });
  }

  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!internalToken) {
    return NextResponse.json({ error: "El servicio de búsqueda no está configurado." }, { status: 503 });
  }
  const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");

  try {
    const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
    const response = await fetch(`${backendUrl}/internal/v1/causas/suggestions`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken,
        ...(cloudflareIp && isIP(cloudflareIp) ? { "X-Client-IP": cloudflareIp } : {}),
      },
      body: JSON.stringify({ query }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    const payload: unknown = await response.json();
    if (!response.ok || !isCompanySuggestionsResponse(payload)) {
      return NextResponse.json({ error: "No fue posible obtener sugerencias." }, { status: response.ok ? 502 : response.status });
    }
    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "No fue posible obtener sugerencias." }, { status: 502 });
  }
}
