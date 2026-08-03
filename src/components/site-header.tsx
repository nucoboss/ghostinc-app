import Link from "next/link";
import { GhostIcon } from "./ghost-icon";

export function SiteHeader() {
  return (
    <header className="site-header">
      <nav className="wrap" aria-label="Navegación principal">
        <Link className="brand" href="/" aria-label="Ghostinc, inicio">
          <GhostIcon />
          Ghostinc
        </Link>
        <div className="nav-links">
          <Link href="/buscar" className="nav-search">Buscar</Link>
          <Link href="/developers">API</Link>
          <Link href="/cuenta" className="nav-cta">Ingresar</Link>
        </div>
      </nav>
    </header>
  );
}
