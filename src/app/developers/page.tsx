import type { Metadata } from "next";
import Link from "next/link";
import { RoamingGhost } from "@/components/roaming-ghost";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "API para desarrolladores | Ghostinc",
  description: "Integra consultas judiciales de empresas chilenas en tus propios sistemas.",
};

const steps = [
  ["01", "Crea tu cuenta", "Regístrate y verifica tu identidad para administrar tu acceso."],
  ["02", "Carga créditos", "Elige un paquete prepago según el volumen de consultas que necesitas."],
  ["03", "Genera una API key", "Crea una credencial por aplicación y conéctala al endpoint real."],
];

export default function DevelopersPage() {
  return (
    <>
      <RoamingGhost />
      <SiteHeader />
      <main className="developer-page">
        <section className="developer-hero">
          <div className="wrap developer-hero-grid">
            <div>
              <span className="eyebrow"><span className="dot" />Ghostinc API</span>
              <h1>Inteligencia judicial dentro de tu producto.</h1>
              <p>Consulta antecedentes judiciales corporativos desde tus flujos de compliance, riesgo y onboarding mediante una API simple y auditable.</p>
              <div className="developer-actions">
                <Link className="button-secondary" href="/playground">Probar playground demo</Link>
                <Link className="button-primary" href="/cuenta">Crear cuenta</Link>
              </div>
            </div>
            <div className="code-window" aria-label="Ejemplo de uso de la API">
              <div className="code-window-bar"><span /><span /><span /><small>request.js</small></div>
              <pre><code>{`const response = await fetch(
  "https://api.ghostinc.cl/api/v1/causas/rut/61502000-1",
  {
    headers: {
      "X-API-Key": process.env.GHOSTINC_API_KEY
    }
  }
);

const { data } = await response.json();
console.log(data.summary);`}</code></pre>
            </div>
          </div>
        </section>

        <section className="developer-section developer-onboarding">
          <div className="wrap">
            <div className="developer-section-head">
              <span className="section-tag">Primeros pasos</span>
              <h2>De la cuenta a producción</h2>
            </div>
            <div className="developer-steps">
              {steps.map(([number, title, text]) => (
                <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="developer-cta">
          <div className="wrap developer-cta-inner">
            <div><span className="section-tag">Portal de cliente</span><h2>Claves, créditos y consumo en un solo lugar.</h2></div>
            <Link className="button-primary inverted" href="/portal-demo">Ver portal demo</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
