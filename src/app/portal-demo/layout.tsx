import type { Metadata } from "next";
import Link from "next/link";
import { GhostIcon } from "@/components/ghost-icon";

export const metadata: Metadata = {
  title: "Portal API demo | Ghostinc",
  description: "Recorrido público por las secciones del portal API de Ghostinc.",
};

const navigation = [
  ["Resumen", "/portal-demo"],
  ["Mi cuenta", "/portal-demo/profile"],
  ["API keys", "/portal-demo/keys"],
  ["Consumo", "/portal-demo/usage"],
  ["Créditos y pagos", "/portal-demo/billing"],
  ["Playground", "/portal-demo/playground"],
];

export default function PortalDemoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="demo-badge">Vista pública</div>
        <nav aria-label="Secciones del portal demo">
          {navigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="dashboard-org">
          <span>Cuenta demostrativa</span>
          <strong>Empresa Demo SpA</strong>
          <small>Datos ficticios</small>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="status-dot" />Portal en modo demostración</div>
          <Link href="/developers">Cerrar demo</Link>
        </header>
        {children}
      </div>
    </div>
  );
}
