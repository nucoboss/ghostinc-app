import type { Metadata } from "next";
import { PlaygroundForm } from "@/components/playground-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "API Playground | Ghostinc",
  description: "Prueba la estructura de la API con datos de ejemplo, sin cuenta ni costo.",
};

export default function PlaygroundPage() {
  return (
    <>
      <SiteHeader />
      <main className="playground-page">
        <section className="wrap">
          <div className="playground-title">
            <div>
              <span className="section-tag">API playground · demostración</span>
              <h1>Prueba la API antes de integrarla</h1>
              <p>
                Consulta y respuesta simuladas sobre la estructura real del endpoint. Los datos
                son de ejemplo, el proceso no consume créditos ni requiere cuenta.
              </p>
            </div>
          </div>
          <PlaygroundForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}