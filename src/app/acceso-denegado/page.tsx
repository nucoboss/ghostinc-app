import Link from "next/link";
import { GhostIcon } from "@/components/ghost-icon";

export default function AccessDeniedPage() {
  return (
    <main className="access-denied">
      <GhostIcon />
      <span className="section-tag">403 · Acceso restringido</span>
      <h1>Esta cuenta no tiene permisos administrativos.</h1>
      <p>Solicita el rol correspondiente al propietario de la organización.</p>
      <Link className="button-secondary" href="/">Volver al inicio</Link>
    </main>
  );
}
