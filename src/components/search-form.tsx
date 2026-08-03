"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { isCausaSearchResponse, isCompanySuggestionsResponse } from "@/lib/causas";
import { isValidRut, normalizeRut } from "@/lib/rut";
import type { Causa, CausaSearchResponse, CompanySuggestion, Litigante } from "@/types/causas";

type SearchKind = "company" | "rut";

const PJUD_CONSULTA_URL = "https://oficinajudicialvirtual.pjud.cl/includes/sesion-consultaunificada.php";

const DEMANDANTE_ROLES = new Set(["DTE.", "RECTE.", "DNCTE."]);
const DEMANDADO_ROLES = new Set(["DDO.", "DDO.SO", "RECDO.", "DNCDO."]);
const SUBJECT_LABELS: Record<string, string> = {
  "DDO.SO": "solidario",
  "RECDO.": "reconvenido",
  "DNCDO.": "no comparecido",
  "RECTE.": "reconviniente",
  "DNCTE.": "no compareciente",
};

function formatDate(value: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Fecha no informada";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function displayValue(value: string | null) {
  return value?.trim() || "No informado";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatRut(value: string) {
  const [body, verifier] = normalizeRut(value).split("-");
  if (!body || !verifier) return value;
  const parts: string[] = [];
  let rest = body;
  while (rest.length > 3) {
    parts.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }
  parts.unshift(rest);
  return `${parts.join(".")}-${verifier}`;
}

function renderParties(parties: Litigante[], fallback: string | null) {
  if (parties.length === 0) return displayValue(fallback);
  return parties.map((party) => {
    const roleLabel = party.sujeto ? SUBJECT_LABELS[party.sujeto] : undefined;
    return (
      <span className="causa-party" key={`${party.rut}-${party.sujeto}-${party.nombre}`}>
        {displayValue(party.nombre)}
        {party.persona === "JURIDICA" && party.rut && <small>RUT {formatRut(party.rut)}</small>}
        {roleLabel && <small>{roleLabel}</small>}
      </span>
    );
  });
}

function CausaCard({ causa }: { causa: Causa }) {
  const demandantes = (causa.litigantes ?? []).filter((litigante) => litigante.sujeto && DEMANDANTE_ROLES.has(litigante.sujeto));
  const demandados = (causa.litigantes ?? []).filter((litigante) => litigante.sujeto && DEMANDADO_ROLES.has(litigante.sujeto));
  return (
    <article className="causa-card">
      <div className="causa-card-head">
        <div>
          <span className="causa-competencia">{causa.competencia}</span>
          <h3>{displayValue(causa.caratulado)}</h3>
        </div>
        <div className="causa-tags">
          <a
            className="causa-rol"
            href={PJUD_CONSULTA_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Buscar el ROL en la consulta unificada de causas del PJUD"
          >
            ROL {causa.rol}
          </a>
          <span className="causa-estado">{displayValue(causa.estado)}</span>
        </div>
      </div>
      <dl className="causa-details">
        <div><dt>Tribunal</dt><dd>{displayValue(causa.tribunal_nombre)}</dd></div>
        <div><dt>Fecha</dt><dd>{formatDate(causa.fecha ?? causa.f_ing)}</dd></div>
        <div><dt>Demandante</dt><dd className="causa-party-list">{renderParties(demandantes, causa.demandante)}</dd></div>
        <div className={demandados.length > 1 ? "causa-detail-wide" : undefined}><dt>Demandado</dt><dd className="causa-party-list">{renderParties(demandados, causa.demandado)}</dd></div>
        {causa.materia && <div><dt>Materia</dt><dd>{causa.materia}{causa.materia_modal ? ` · ${causa.materia_modal}` : ""}</dd></div>}
        {causa.etapa && <div><dt>Etapa</dt><dd>{causa.etapa}</dd></div>}
        {causa.proc && <div><dt>Procedimiento</dt><dd>{causa.proc}</dd></div>}
      </dl>
    </article>
  );
}

export function SearchForm() {
  const [kind, setKind] = useState<SearchKind>("company");
  const [query, setQuery] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [result, setResult] = useState<CausaSearchResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const requestRef = useRef<AbortController>(null);
  const suggestionRequestRef = useRef<AbortController>(null);

  useEffect(() => () => {
    requestRef.current?.abort();
    suggestionRequestRef.current?.abort();
  }, []);

  useEffect(() => {
    suggestionRequestRef.current?.abort();
    if (kind !== "company" || !suggestionsOpen) {
      setSuggestionsLoading(false);
      return;
    }

    const company = query.trim().replace(/\s+/g, " ");
    if (company.length < 3 || !/[\p{L}\p{N}]/u.test(company)) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    suggestionRequestRef.current = controller;
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch("/api/causas/sugerencias", {
          method: "POST",
          signal: controller.signal,
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ query: company }),
        });
        const payload: unknown = await response.json();
        if (suggestionRequestRef.current === controller) {
          setSuggestions(response.ok && isCompanySuggestionsResponse(payload) ? payload.data : []);
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "AbortError")) setSuggestions([]);
      } finally {
        if (suggestionRequestRef.current === controller) setSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [kind, query, suggestionsOpen]);

  function selectKind(nextKind: SearchKind) {
    requestRef.current?.abort();
    suggestionRequestRef.current?.abort();
    setKind(nextKind);
    setQuery("");
    setResult(null);
    setMessage("");
    setSuggestions([]);
    setSuggestionsOpen(false);
  }

  async function search(searchKind: SearchKind, value: string) {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    suggestionRequestRef.current?.abort();
    setLoading(true);
    setResult(null);
    setActiveSearch(value);
    setMessage("");
    setSuggestions([]);
    setSuggestionsOpen(false);

    try {
      const response = await fetch("/api/causas", {
        method: "POST",
        signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ kind: searchKind, query: value }),
      });
      const payload: unknown = await response.json();

      if (!response.ok) {
        const error = payload && typeof payload === "object" && "error" in payload
          ? String(payload.error)
          : "No fue posible completar la búsqueda.";
        throw new Error(error);
      }
      if (!isCausaSearchResponse(payload)) throw new Error("El servicio devolvió una respuesta inválida.");
      setResult(payload);
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setMessage(error instanceof Error ? error.message : "No fue posible completar la búsqueda.");
    } finally {
      if (requestRef.current === controller) setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (kind === "rut") {
      const rut = normalizeRut(query);
      if (!isValidRut(rut)) {
        setResult(null);
        setMessage("Ingresa un RUT chileno válido.");
        return;
      }
      setQuery(rut);
      void search(kind, rut);
      return;
    }

    const company = query.trim().replace(/\s+/g, " ");
    if (company.length < 3 || !/[\p{L}\p{N}]/u.test(company)) {
      setResult(null);
      setMessage("Ingresa al menos 3 caracteres del nombre de la empresa.");
      return;
    }
    setQuery(company);
    void search(kind, company);
  }

  const summary = result?.data.summary;
  const searchLabel = kind === "company" ? `empresa “${activeSearch}”` : `RUT ${activeSearch}`;

  return (
    <div className="search-experience" aria-busy={loading}>
      <div className="search-kind" role="group" aria-label="Tipo de búsqueda">
        <button type="button" aria-pressed={kind === "company"} onClick={() => selectKind("company")}>Empresa por nombre</button>
        <button type="button" aria-pressed={kind === "rut"} onClick={() => selectKind("rut")}>Por RUT</button>
      </div>

      <form className="search-box" onSubmit={handleSubmit}>
        <div className="search-terminal">
          <span className="prompt" aria-hidden="true">&gt;</span>
          <label className="sr-only" htmlFor="company-query">
            {kind === "company" ? "Nombre de empresa" : "RUT de persona o empresa"}
          </label>
          <input
            id="company-query"
            name="query"
            type="search"
            inputMode="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setMessage("");
              if (kind === "company") setSuggestionsOpen(true);
            }}
            onFocus={() => {
              if (kind === "company" && query.trim().length >= 3) setSuggestionsOpen(true);
            }}
            placeholder={kind === "company" ? "Razón social, ej. Empresa Demo SPA" : "RUT, ej. 61.502.000-1"}
            autoComplete="off"
            aria-invalid={Boolean(message)}
            aria-describedby="search-note search-feedback"
            aria-autocomplete={kind === "company" ? "list" : "none"}
            aria-controls={kind === "company" ? "company-suggestions" : undefined}
            aria-expanded={kind === "company" && suggestionsOpen && suggestions.length > 0}
          />
          <button type="submit" disabled={loading}>{loading ? "Buscando..." : "Buscar"}</button>
        </div>
        {kind === "company" && suggestionsOpen && (suggestionsLoading || suggestions.length > 0) && (
          <div className="company-suggestions" id="company-suggestions" role="listbox" aria-label="Empresas sugeridas">
            {suggestionsLoading && <p role="status">Buscando empresas…</p>}
            {!suggestionsLoading && suggestions.map((suggestion) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={`${suggestion.rut}-${suggestion.nombre}`}
                onClick={() => {
                  setQuery(suggestion.nombre);
                  setSuggestions([]);
                  setSuggestionsOpen(false);
                  setMessage("");
                }}
              >
                <span>{suggestion.nombre}</span>
                <small>RUT {suggestion.rut} · {suggestion.causas.toLocaleString("es-CL")} causas</small>
              </button>
            ))}
          </div>
        )}
        <p className="search-note" id="search-note">
          {kind === "company"
            ? "La búsqueda por nombre incluye solo personas jurídicas; las personas naturales se consultan por RUT. "
            : "Consulta por RUT de persona o empresa. "}
          La muestra gratuita está fijada en las 10 causas abiertas más recientes en que
          {kind === "company" ? " la empresa" : " el RUT"} figura como demandado, en competencias laboral, cobranza y civil.{" "}
          <a href="/developers">Usa la API Ghostinc</a> para el historial completo: cerradas, como demandante, litigantes y RUTs.
        </p>
        {message && <p className="search-feedback" id="search-feedback" role="alert">{message}</p>}
      </form>

      {loading && <div className="search-loading" role="status">Consultando registros judiciales públicos…</div>}

      {result && summary && (
        <section className="results-panel" aria-label={`Causas judiciales para ${searchLabel}`}>
          <div className="results-head">
            <div>
              <span className="section-tag">Perfil judicial · {searchLabel}</span>
              <h2>Panorama global</h2>
            </div>
            {(summary.fecha_desde || summary.fecha_hasta) && (
              <span className="results-range">Rango de Fechas: {formatDate(summary.fecha_desde)} — {formatDate(summary.fecha_hasta)}</span>
            )}
          </div>

          <div className="summary-grid">
            <div><strong>{summary.total_demandante.toLocaleString("es-CL")}</strong><span>Como demandante</span></div>
            <div><strong>{summary.total_demandado.toLocaleString("es-CL")}</strong><span>Como demandado</span></div>
            <div><strong>{summary.total_abiertas.toLocaleString("es-CL")}</strong><span>Causas abiertas</span></div>
            <div><strong>{summary.total_cerradas.toLocaleString("es-CL")}</strong><span>Causas cerradas</span></div>
            <div><strong>{summary.tribunales.toLocaleString("es-CL")}</strong><span>Tribunales</span></div>
          </div>

          {Object.keys(summary.total_por_competencia).length > 0 && (
            <div className="competencias-summary">
              <span>Distribución global</span>
              <div>
                {Object.entries(summary.total_por_competencia)
                  .sort(([, first], [, second]) => second - first)
                  .map(([competencia, total]) => (
                    <span key={competencia}>{titleCase(competencia)} <strong>{total.toLocaleString("es-CL")}</strong></span>
                  ))}
              </div>
            </div>
          )}

          <div className="detail-head">
            <div>
              <span className="section-tag">Muestra gratuita</span>
              <h3>{summary.total.toLocaleString("es-CL")} causas abiertas como demandado</h3>
            </div>
            <span className="results-range">{summary.total === 0 ? "Sin registros" : `Mostrando ${summary.count} de ${summary.total}`}</span>
          </div>

          <div className="causas-list">
            {result.data.causas.map((causa) => <CausaCard causa={causa} key={causa.id} />)}
            {result.data.causas.length === 0 && (
              <p className="empty-result">No encontramos causas abiertas como demandado para esta búsqueda.</p>
            )}
          </div>

          <p className="results-api-note">
            Muestra gratuita: top 10 de causas abiertas en que figura como demandado (laboral, cobranza y civil).{" "}
            <a href="/developers">Consulta el historial completo con la API Ghostinc</a>.
          </p>
        </section>
      )}
    </div>
  );
}
