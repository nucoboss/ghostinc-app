import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata = {
  title: "Términos y condiciones | Ghostinc",
  description:
    "Ghostinc es un servicio no oficial; los datos provienen de fuentes oficiales públicas y se almacenan de forma segura.",
};

export default function TerminosPage() {
  return (
    <>
      <SiteHeader />
      <main className="legal-page">
        <section className="wrap">
          <span className="section-tag">Términos y condiciones</span>
          <h1>Servicio no oficial con datos de fuentes públicas</h1>

          <section>
            <h2>Naturaleza del servicio</h2>
            <p>
              Ghostinc no es un servicio oficial del Poder Judicial de Chile ni de ninguna
              institución pública o privada, y no mantiene vínculo, patrocinio ni aval con ellas.
              Es una herramienta independiente de consulta e investigación (OSINT) construida
              exclusivamente sobre registros judiciales de acceso público.
            </p>
          </section>

          <section>
            <h2>Origen de los datos</h2>
            <p>
              Los datos que expone esta API son <strong>reales</strong>: se obtienen directamente
              de fuentes oficiales públicas (Poder Judicial de Chile y otras instituciones),
              consultadas por los canales de acceso público que esas mismas fuentes habilitan.
            </p>
            <p>
              <strong>Los datos de ningún modo provienen de filtraciones.</strong> Ghostinc no
              utiliza, almacena ni sirve información obtenida de fugas o filtraciones de datos,
              accesos indebidos, compromisos de servidores, bases de datos sustraídas de terceros
              ni ningún otro origen no autorizado. Toda la información publicada tiene origen en
              fuentes oficiales de acceso público y fue recolectada a través de los mecanismos
              que esas fuentes destinan para su consulta.
            </p>
          </section>

          <section>
            <h2>Tratamiento de los datos</h2>
            <p>
              Los datos obtenidos se normalizan, estructuran, almacenan y sirven tal como fueron
              publicados en su origen, sin filtros que alteren su contenido. Esto permite
              búsquedas y consultas históricas conservando la trazabilidad hacia la fuente
              original.
            </p>
            <ul>
              <li>Datos reales obtenidos de fuentes oficiales públicas.</li>
              <li>Sin filtrado, selección ni modificación de la información consultada.</li>
              <li>Almacenamiento orientado a consultas históricas y trazabilidad.</li>
            </ul>
          </section>

          <section>
            <h2>Almacenamiento seguro</h2>
            <p>
              Aplicamos medidas técnicas, organizativas y de seguridad de la información acordes a
              la normativa de protección de datos personales chilena (Ley N.º 19.628 y sus
              modificaciones), así como a buenas prácticas internacionales en gestión de datos:
            </p>
            <ul>
              <li>Acceso restringido a personal autorizado, según el principio de mínimo privilegio.</li>
              <li>Cifrado de la información en tránsito y en reposo.</li>
              <li>Registro y auditoría de accesos a los sistemas que almacenan y sirven datos.</li>
              <li>Minimización de datos: solo se almacena lo necesario para la finalidad del servicio.</li>
              <li>Retención limitada y controles para el borrado seguro cuando corresponda.</li>
            </ul>
            <p>
              Cualquier información de personas naturales (por ejemplo, intervinientes en causas)
              se trata con la máxima confidencialidad y únicamente con fines de consulta pública,
              conforme a lo que las propias fuentes oficiales publican.
            </p>
          </section>

          <section>
            <h2>Protección de datos personales</h2>
            <p>
              Ghostinc <strong>cumple con la ley chilena de protección de datos personales</strong>{" "}
              (Ley N.º 19.628 y sus modificaciones, incluida la nueva Ley N.º 21.719 de
              protección de datos personales en materia de tratamiento, aún en vacancia legal).
              El tratamiento de los datos que realizamos se enmarca en la finalidad de consulta
              pública e investigación corporativa, aplicando los principios de licitud, finalidad,
              proporcionalidad y seguridad.
            </p>
            <p>
              <strong>No exponemos información sensible de personas naturales.</strong> No
              publicamos, procesamos ni facilitamos datos sensibles de intervinientes
              individuales de las causas: entre otros, no se exponen antecedentes de carácter
              sanitario, financiero particular, religioso, de orientación o de vida privada de
              personas naturales. La información de personas naturales se limita a la que las
              fuentes oficiales públicas exponen como parte del caratulado y de los roles de las
              causas, y solo con fines de consulta.
            </p>
          </section>

          <section>
            <h2>Alcance de la información</h2>
            <p>
              La información entregada no constituye una certificación oficial ni asesoría legal.
              Antes de tomar decisiones basadas en estos datos, verifica el estado de la causa en
              el tribunal o el portal oficial del Poder Judicial (consulta unificada de causas).
            </p>
          </section>

          <Link className="button-secondary" href="/">Volver al inicio</Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}