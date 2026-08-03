import { config } from "../config.js";

const ALLOWED_QUERY_PARAMS = new Set([
  "nombre",
  "limit",
  "offset",
  "participacion",
  "competencia",
  "include_abogados",
  "estado",
  "q",
  "fecha_desde",
  "fecha_hasta",
  "tribunal_id",
  "tipo_causa",
]);

export class PjudError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

function isPjudPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return false;
  const { summary, causas } = data as { summary?: unknown; causas?: unknown };
  if (!summary || typeof summary !== "object" || !Array.isArray(causas)) return false;

  const requiredNumbers = [
    "total", "total_demandante", "total_demandado", "total_abiertas",
    "total_cerradas", "tribunales", "count", "limit", "offset",
  ];
  return requiredNumbers.every((field) => typeof (summary as Record<string, unknown>)[field] === "number")
    && typeof (summary as Record<string, unknown>).total_por_competencia === "object";
}

async function fetchPjud(path: string, query: Record<string, unknown>) {
  const url = new URL(`${config.pjudBaseUrl}${path}`);

  for (const [name, rawValue] of Object.entries(query)) {
    if (!ALLOWED_QUERY_PARAMS.has(name) || rawValue === undefined || rawValue === null || rawValue === "") continue;
    url.searchParams.set(name, String(rawValue).slice(0, 200));
  }

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(config.pjudApiKey ? { "X-API-Key": config.pjudApiKey } : {}),
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const status = response.status === 404 ? 404 : response.status === 422 ? 400 : 502;
    throw new PjudError(status, status === 404 ? "No se encontraron causas." : "El proveedor judicial no está disponible.");
  }

  return response.json() as Promise<unknown>;
}

async function requestPjud(path: string, query: Record<string, unknown>) {
  const payload = await fetchPjud(path, query);
  if (!isPjudPayload(payload)) throw new PjudError(502, "El proveedor judicial devolvió una respuesta inválida.");
  return payload;
}

export function searchPjud(rut: string, query: Record<string, unknown>) {
  return requestPjud(`/causas/rut/${encodeURIComponent(rut)}`, query);
}

export function searchPjudCompany(nombre: string, query: Record<string, unknown>) {
  return requestPjud("/causas/empresa/nombre", { ...query, nombre });
}

export async function searchPjudCompanySuggestions(nombre: string, limit = 8) {
  const payload = await fetchPjud("/causas/empresa/sugerencias", { nombre, limit });
  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new PjudError(502, "El proveedor judicial devolvió una respuesta inválida.");
  }
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || !data.every((item) => {
    if (!item || typeof item !== "object") return false;
    const suggestion = item as Record<string, unknown>;
    return typeof suggestion.nombre === "string"
      && typeof suggestion.rut === "string"
      && typeof suggestion.causas === "number";
  })) {
    throw new PjudError(502, "El proveedor judicial devolvió una respuesta inválida.");
  }
  return { data };
}
