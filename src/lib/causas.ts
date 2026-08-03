import type {
  Causa,
  CausaSearchResponse,
  CausaSummary,
  CompanySuggestionsResponse,
  Litigante,
} from "@/types/causas";

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isLitigante(value: unknown): value is Litigante {
  if (!value || typeof value !== "object") return false;
  const litigante = value as Record<string, unknown>;
  return [
    "nombre", "rut", "persona", "sujeto",
  ].every((field) => isNullableString(litigante[field]));
}

function isSummary(value: unknown): value is CausaSummary {
  if (!value || typeof value !== "object") return false;
  const summary = value as Record<string, unknown>;
  const numericFields = [
    "total", "total_demandante", "total_demandado", "total_abiertas",
    "total_cerradas", "tribunales", "count", "limit", "offset",
  ];
  if (!numericFields.every((field) => Number.isFinite(summary[field]))) return false;
  if (!isNullableString(summary.fecha_desde) || !isNullableString(summary.fecha_hasta)) return false;
  if (!summary.total_por_competencia || typeof summary.total_por_competencia !== "object") return false;
  return Object.values(summary.total_por_competencia).every(Number.isFinite);
}

function isCausa(value: unknown): value is Causa {
  if (!value || typeof value !== "object") return false;
  const causa = value as Record<string, unknown>;
  return typeof causa.id === "number"
    && typeof causa.competencia === "string"
    && typeof causa.rol === "string"
    && typeof causa.tribunal_id === "string"
    && [
      "tribunal_nombre", "corte_id", "fecha", "estado", "caratulado", "demandante",
      "demandado", "ruc", "materia", "materia_modal", "proc", "etapa", "f_ing",
      "modal_enriched_at",
    ].every((field) => isNullableString(causa[field]))
    && (causa.litigantes === undefined
      || (Array.isArray(causa.litigantes) && causa.litigantes.every(isLitigante)));
}

export function isCausaSearchResponse(value: unknown): value is CausaSearchResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = (value as { data?: unknown }).data;
  if (!data || typeof data !== "object") return false;
  const { summary, causas } = data as { summary?: unknown; causas?: unknown };
  return isSummary(summary) && Array.isArray(causas) && causas.every(isCausa);
}

export function isCompanySuggestionsResponse(value: unknown): value is CompanySuggestionsResponse {
  if (!value || typeof value !== "object" || !("data" in value)) return false;
  const data = (value as { data?: unknown }).data;
  return Array.isArray(data) && data.every((item) => {
    if (!item || typeof item !== "object") return false;
    const suggestion = item as Record<string, unknown>;
    return typeof suggestion.nombre === "string"
      && typeof suggestion.rut === "string"
      && typeof suggestion.causas === "number";
  });
}
