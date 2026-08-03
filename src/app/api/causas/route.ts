import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { isCausaSearchResponse } from "@/lib/causas";
import { isValidRut, normalizeRut } from "@/lib/rut";

export const dynamic = "force-dynamic";

type SearchBody = { kind: "rut" | "company"; query: string };

function parseBody(value: unknown): SearchBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => key !== "kind" && key !== "query")) return null;
  if ((body.kind !== "rut" && body.kind !== "company") || typeof body.query !== "string") return null;

  if (body.kind === "rut") {
    const rut = normalizeRut(body.query);
    return isValidRut(rut) ? { kind: "rut", query: rut } : null;
  }

  const company = body.query.trim().replace(/\s+/g, " ");
  if (company.length < 3 || company.length > 120 || !/[\p{L}\p{N}]/u.test(company)) return null;
  return { kind: "company", query: company };
}

function errorMessage(payload: unknown) {
  return payload && typeof payload === "object" && "message" in payload
    ? String(payload.message)
    : "No fue posible completar la búsqueda.";
}

export async function POST(request: NextRequest) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const body = parseBody(rawBody);
  if (!body) {
    return NextResponse.json({ error: "Ingresa un RUT válido o al menos 3 caracteres del nombre de la empresa." }, { status: 400 });
  }

  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  if (!internalToken) {
    return NextResponse.json({ error: "El servicio de búsqueda no está configurado." }, { status: 503 });
  }

  const backendUrl = (process.env.BACKEND_INTERNAL_URL ?? "http://localhost:4000").replace(/\/$/, "");

  try {
    const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
    const response = await fetch(`${backendUrl}/internal/v1/causas/search`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken,
        ...(cloudflareIp && isIP(cloudflareIp) ? { "X-Client-IP": cloudflareIp } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(17_000),
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "El servicio de búsqueda devolvió una respuesta inválida." }, { status: 502 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: errorMessage(payload) }, { status: response.status });
    }
    if (!isCausaSearchResponse(payload)) {
      return NextResponse.json({ error: "El servicio de búsqueda devolvió una respuesta inválida." }, { status: 502 });
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return NextResponse.json(
      { error: timedOut ? "La consulta excedió el tiempo de espera." : "No fue posible conectar con el servicio de búsqueda." },
      { status: 502 },
    );
  }
}
