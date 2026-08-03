import { RoamingGhost } from "@/components/roaming-ghost";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { CardIcon } from "@/components/icons";
import Link from "next/link";

const useCases = [
  {
    number: "01",
    icon: "home",
    title: "Riesgo de arrendatarios",
    description:
      "Contrasta antecedentes judiciales públicos antes de celebrar un contrato de arriendo y detecta litigios que requieren revisión adicional.",
    signal: "Arriendos y garantías",
  },
  {
    number: "02",
    icon: "briefcase",
    title: "Riesgo de nuevos negocios",
    description:
      "Conoce el perfil judicial de una contraparte antes de contratar, asociarte, conceder crédito o iniciar una relación comercial.",
    signal: "Riesgo comercial",
  },
  {
    number: "03",
    icon: "user-check",
    title: "Onboarding de proveedores",
    description:
      "Agrega antecedentes judiciales públicos a tus procesos de compliance, homologación y evaluación periódica de proveedores.",
    signal: "Compliance y compras",
  },
  {
    number: "04",
    icon: "shield",
    title: "Due diligence corporativo",
    description:
      "Identifica causas, roles procesales y patrones de litigación antes de una inversión, adquisición o alianza estratégica.",
    signal: "Inversión y M&A",
  },
] as const;

const coverageMetrics = [
  {
    value: "+1,3 M",
    label: "causas almacenadas",
  },
  {
    value: "+42 mil",
    label: "RUT de empresas",
  },
  {
    value: "+803 mil",
    label: "litigantes estructurados",
  },
  {
    value: "254",
    label: "tribunales registrados",
  },
  {
    value: "Desde 2020",
    label: "cobertura histórica",
  },
] as const;

export default function Home() {
  return (
    <>
      <RoamingGhost />
      <SiteHeader />

      <main>
        <section className="hero" id="inicio">
          <div className="wrap hero-content">
            <span className="eyebrow"><span className="dot" />OSINT corporativo · Chile</span>
            <h1>Consulta antecedentes judiciales de empresas chilenas.</h1>
            <p className="sub">
              Consulta causas judiciales públicas asociadas a empresas chilenas y detecta antecedentes relevantes antes de invertir, publicar o contratar.
            </p>
            <div className="hero-actions">
              <Link href="/buscar" className="nav-cta">Buscar gratis</Link>
              <Link href="/developers">Explorar la API</Link>
            </div>
          </div>
        </section>

        <section className="home-use-cases" aria-labelledby="use-cases-title">
          <div className="wrap">
            <div className="coverage-head">
              <div>
                <span className="section-tag">Cobertura disponible</span>
                <h2>Información pública convertida en datos consultables.</h2>
              </div>
            </div>

            <div className="coverage-grid">
              {coverageMetrics.map((metric) => (
                <div className="coverage-card" key={metric.label}>
                  <strong>{metric.value}</strong>
                  <span>{metric.label}</span>
                </div>
              ))}
            </div>

            <div className="use-cases-layout">
              <div className="use-cases-copy">
                <span className="section-tag">Casos de uso</span>
                <h2 id="use-cases-title">Una señal adicional antes de decidir.</h2>
                <p>
                  Incorpora antecedentes judiciales públicos a procesos de evaluación, riesgo y
                  compliance. La información complementa, pero no reemplaza, la verificación
                  oficial ni el análisis humano.
                </p>
                <Link href="/buscar">Explorar una búsqueda gratuita →</Link>
              </div>

              <div className="use-cases-list">
                {useCases.map((useCase) => (
                  <article className="use-case-card" key={useCase.number}>
                    <div className="use-case-card-meta">
                      <span className="use-case-card-meta-icon"><CardIcon name={useCase.icon} /></span>
                      <span>{useCase.number}</span>
                      <span>{useCase.signal}</span>
                    </div>
                    <h3>{useCase.title}</h3>
                    <p>{useCase.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </>
  );
}
