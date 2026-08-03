import Link from "next/link";
import { PlaygroundForm } from "@/components/playground-form";

export default function PortalDemoPlaygroundPage() {
  return (
    <main className="dashboard-content">
      <div className="playground-title">
        <div><span className="section-tag">API Playground</span><h1>Construye una consulta</h1><p>Modifica parámetros y revisa una respuesta simulada con la estructura del endpoint.</p></div>
        <div className="playground-actions"><Link href="/developers">Ver documentación →</Link></div>
      </div>
      <PlaygroundForm />
    </main>
  );
}
