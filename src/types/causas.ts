export type CausaSummary = {
  total: number;
  total_demandante: number;
  total_demandado: number;
  total_abiertas: number;
  total_cerradas: number;
  total_por_competencia: Record<string, number>;
  tribunales: number;
  fecha_desde: string | null;
  fecha_hasta: string | null;
  count: number;
  limit: number;
  offset: number;
};

export type Litigante = {
  nombre: string | null;
  rut: string | null;
  persona: string | null;
  sujeto: string | null;
};

export type Causa = {
  id: number;
  competencia: string;
  rol: string;
  tribunal_id: string;
  tribunal_nombre: string | null;
  corte_id: string | null;
  fecha: string | null;
  estado: string | null;
  caratulado: string | null;
  demandante: string | null;
  demandado: string | null;
  ruc: string | null;
  materia: string | null;
  materia_modal: string | null;
  proc: string | null;
  etapa: string | null;
  f_ing: string | null;
  modal_enriched_at: string | null;
  litigantes?: Litigante[];
};

export type CausaSearchResponse = {
  data: {
    summary: CausaSummary;
    causas: Causa[];
  };
};

export type CompanySuggestion = {
  nombre: string;
  rut: string;
  causas: number;
};

export type CompanySuggestionsResponse = {
  data: CompanySuggestion[];
};
