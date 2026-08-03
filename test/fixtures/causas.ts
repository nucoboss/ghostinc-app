import type { CausaSearchResponse } from "@/types/causas";

export function causaResponse(total = 1): CausaSearchResponse {
  return {
    data: {
      summary: {
        total,
        total_demandante: 0,
        total_demandado: total,
        total_abiertas: total,
        total_cerradas: 0,
        total_por_competencia: total ? { laboral: total } : {},
        tribunales: total ? 1 : 0,
        fecha_desde: total ? "2025-01-02" : null,
        fecha_hasta: total ? "2025-01-02" : null,
        count: total,
        limit: 10,
        offset: 0,
      },
      causas: total ? [{
        id: 1,
        competencia: "laboral",
        rol: "O-1-2025",
        tribunal_id: "T-001",
        tribunal_nombre: "Juzgado de prueba",
        corte_id: null,
        fecha: "2025-01-02",
        estado: "Tramitación",
        caratulado: "Empresa Demo SPA con Fixture",
        demandante: "Fixture",
        demandado: "Empresa Demo SPA",
        ruc: null,
        materia: "Cobro",
        materia_modal: null,
        proc: null,
        etapa: "Conocimiento",
        f_ing: null,
        modal_enriched_at: null,
      }] : [],
    },
  };
}
