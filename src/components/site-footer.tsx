import Link from "next/link";
import { GhostIcon } from "./ghost-icon";

export function SiteFooter() {
  return (
    <footer id="contacto">
      <div className="wrap">
        <div className="foot-brand">
          <GhostIcon />
          Ghostinc © 2026
        </div>
        <div className="foot-links" aria-label="Enlaces del sitio">
          <Link href="/developers">API</Link>
          <Link href="/terminos">Términos</Link>
          <span>Privacidad</span>
          <span>Contacto</span>
        </div>
      </div>
    </footer>
  );
}
