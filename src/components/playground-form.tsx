"use client";

import { useMemo, useState } from "react";

type Participacion = "ambas" | "demandante" | "demandado";
type Estado = "abiertas" | "cerradas";
type Competencia = "" | "laboral" | "civil" | "cobranza" | "penal";

const ROL_PREFIX: Record<string, string> = {
  laboral: "O",
  civil: "C",
  cobranza: "C",
  penal: "R",
};

const TRIBUNALES: Record<string, string> = {
  laboral: "1º Juzgado de Letras del Trabajo de Santiago",
  civil: "30º Juzgado de Letras en lo Civil de Santiago",
  cobranza: "Juzgado de Letras del Trabajo de Santiago (Cumplimiento)",
  penal: "2º Juzgado de Garantía de Santiago",
};

const MATERIA_MODAL: Record<string, string> = {
  laboral: "Prestaciones",
  civil: "Incumplimiento de contrato",
  cobranza: "Cumplimiento Laboral (ejecutivo)",
  penal: "Audiencia de juicio",
};

const DEMANDADOS: Record<string, Array<[string, string]>> = {
  laboral: [
    ["CVE EMPRESA DEMO S.A", "76481202-1"],
    ["MINERA CENTINO S.A", "76727040-2"],
    ["SOLUCIONES LOGISTICAS SUR SPA", "77290456-4"],
  ],
  civil: [
    ["INMOBILIARIA ALMENDRAL S.A", "76213450-0"],
    ["CONSTRUCTORA ALTURA S.A.", "77103451-6"],
  ],
  cobranza: [
    ["TRANSPORTES ANDES S.A", "76490122-9"],
    ["SERVICIOS TOSTÁN Y CIA LTDA", "77151230-6"],
  ],
  penal: [["INVERSIONES CLARO S.A", "77818444-1"]],
};

const BASE_TOTALS: Record<string, number> = {
  laboral: 48,
  civil: 14,
  cobranza: 33,
  penal: 6,
};

const DEMANDANTE_NOMBRE = "VIVIANA ACUÑA";
const DEMANDANTE_RUT = "98765432-1";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

type QueryParams = {
  rut: string;
  participacion: Participacion;
  estado: Estado;
  competencia: Competencia;
  limit: number;
};

function buildSample(params: QueryParams) {
  const competencia = params.competencia || "laboral";
  const count = Math.min(Math.max(params.limit, 1), 500);
  const prefix = ROL_PREFIX[competencia];
  const total = BASE_TOTALS[competencia] + Math.min(count, 40);
  const totalDentro =
    params.participacion === "demandante"
      ? Math.round(total * 0.38)
      : params.participacion === "demandado"
        ? total
        : Math.round(total * 0.62);
  const totalContra =
    params.participacion === "demandante"
      ? total
      : params.participacion === "demandado"
        ? Math.round(total * 0.38)
        : Math.round(total * 0.4);
  const abiertas =
    params.estado === "abiertas" ? total : params.estado === "cerradas" ? Math.round(total * 0.28) : Math.round(total * 0.55);
  const cerradas = total - abiertas;
  const tribunal = TRIBUNALES[competencia];
  const personas = DEMANDADOS[competencia];

  const causas = [];
  for (let i = 0; i < count; i += 1) {
    const [nombreDemandado, rutDemandado] = personas[i % personas.length];
    const year = 2024 + (i % 3);
    const estado =
      params.estado === "abiertas"
        ? "Tramitación"
        : params.estado === "cerradas"
          ? "Concluido"
          : i % 3 === 2
            ? "Concluido"
            : "Tramitación";
    causas.push({
      id: 9001000 + i,
      competencia,
      rol: `${prefix}-${1200 + i}-${year}`,
      tribunal_id: "T-DEMO",
      tribunal_nombre: tribunal,
      corte_id: null,
      fecha: `${year}-${pad(1 + (i % 12))}-${pad(1 + (i % 27))}`,
      estado,
      caratulado: `${DEMANDANTE_NOMBRE.split(" ")[0]}/${nombreDemandado}`,
      demandante: DEMANDANTE_NOMBRE,
      demandado: nombreDemandado,
      ruc: null,
      materia: competencia,
      materia_modal: MATERIA_MODAL[competencia],
      proc: "Ordinario",
      etapa: "Audiencia de juicio",
      f_ing: `${year}-${pad(1 + (i % 12))}-01`,
      modal_enriched_at: null,
      litigantes: [
        { nombre: DEMANDANTE_NOMBRE, rut: DEMANDANTE_RUT, persona: "NATURAL", sujeto: "DTE." },
        { nombre: nombreDemandado, rut: rutDemandado, persona: "JURIDICA", sujeto: "DDO." },
      ],
    });
  }

  const query = ["participacion", "estado", "competencia"]
    .filter((key) => key === "estado" ? params.estado : key === "competencia" ? params.competencia : params.participacion !== "ambas")
    .map((key) => {
      if (key === "participacion") return `participacion=${params.participacion}`;
      if (key === "estado") return `estado=${params.estado}`;
      return `competencia=${params.competencia}`;
    });
  const querystring = [...query, `limit=${count}`].join("&");

  const request = `curl -s "https://api.ghostinc.cl/api/v1/causas/rut/${params.rut}?${querystring}" \\
  -H "X-API-Key: pgh_demo_${"x".repeat(24)}"`;

  const response = JSON.stringify(
    {
      data: {
        summary: {
          total,
          total_demandante: totalDentro,
          total_demandado: totalContra,
          total_abiertas: abiertas,
          total_cerradas: cerradas,
          total_por_competencia: { [competencia]: total },
          tribunales: competencia === "civil" ? 5 : 8,
          fecha_desde: "2020-01-15",
          fecha_hasta: "2026-07-30",
          count,
          limit: count,
          offset: 0,
        },
        causas,
      },
    },
    null,
    2,
  );

  return { request, response };
}

export function PlaygroundForm() {
  const [rut, setRut] = useState("61.502.000-1");
  const [participacion, setParticipacion] = useState<Participacion>("ambas");
  const [estado, setEstado] = useState<Estado>("abiertas");
  const [competencia, setCompetencia] = useState<Competencia>("");
  const [limit, setLimit] = useState("3");

  const sample = useMemo(() => {
    const parsed = Number.parseInt(limit, 10);
    return buildSample({
      rut: rut.trim() || "61.502.000-1",
      participacion,
      estado,
      competencia,
      limit: Number.isFinite(parsed) ? parsed : 10,
    });
  }, [rut, participacion, estado, competencia, limit]);

  return (
    <div className="playground-grid">
      <form className="playground-controls" onSubmit={(event) => event.preventDefault()}>
        <div className="playground-mode"><span className="status-dot" />Entorno demo · datos de ejemplo · sin cuenta ni créditos</div>
        <label htmlFor="pg-rut">RUT</label><input id="pg-rut" value={rut} onChange={(event) => setRut(event.target.value)} />
        <label htmlFor="pg-participacion">Participación</label>
        <select id="pg-participacion" value={participacion} onChange={(event) => setParticipacion(event.target.value as Participacion)}>
          <option value="ambas">Ambas</option><option value="demandante">Demandante</option><option value="demandado">Demandado</option>
        </select>
        <label htmlFor="pg-estado">Estado</label>
        <select id="pg-estado" value={estado} onChange={(event) => setEstado(event.target.value as Estado)}>
          <option value="abiertas">Abiertas</option><option value="cerradas">Cerradas</option>
        </select>
        <label htmlFor="pg-competencia">Competencia</label>
        <select id="pg-competencia" value={competencia} onChange={(event) => setCompetencia(event.target.value as Competencia)}>
          <option value="">Todas</option><option value="laboral">laboral</option><option value="civil">civil</option><option value="cobranza">cobranza</option><option value="penal">penal</option>
        </select>
        <label htmlFor="pg-limit">Límite</label><input id="pg-limit" type="number" min="1" max="500" value={limit} onChange={(event) => setLimit(event.target.value)} />
        <p>La consulta y la respuesta se regeneran en vivo con cada cambio. La ejecución real requiere una API key.</p>
      </form>
      <div className="playground-output">
        <div className="playground-output-head"><span>200 · application/json</span><small>Simulado · 0 crédito</small></div>
        <div className="playground-request"><code>{sample.request}</code></div>
        <pre><code>{sample.response}</code></pre>
      </div>
    </div>
  );
}