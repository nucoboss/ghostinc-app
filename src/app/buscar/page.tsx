import { SearchForm } from "@/components/search-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function SearchPage() {
  return (
    <>
      <SiteHeader />
      <main className="search-page">
        <section className="wrap search-page-head">
          <span className="eyebrow"><span className="dot" />Consulta judicial gratuita</span>
          <h1>Busca causas por empresa o RUT</h1>
          <p>Consulta registros judiciales públicos del PJUD con filtros fijos y una muestra máxima de 10 resultados.</p>
          <SearchForm />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
