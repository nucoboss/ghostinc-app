import type { Metadata } from "next";
import Link from "next/link";
import { GhostIcon } from "@/components/ghost-icon";

export const metadata: Metadata = {
  title: "No fue posible ingresar | Ghostinc",
};

export default function LoginErrorPage() {
  return (
    <main className="access-denied">
      <GhostIcon />
      <span className="section-tag">Acceso no completado</span>
      <h1>No fue posible autorizar esta cuenta.</h1>
      <p>El acceso pudo ser cancelado, estar bloqueado o requerir revisión. Si administras la cuenta, comprueba su estado antes de intentarlo nuevamente.</p>
      <div className="access-denied-actions">
        <a className="button-primary" href="/auth/login?returnTo=/dashboard">Intentar ingresar nuevamente</a>
        <Link className="button-secondary" href="/">Volver al inicio</Link>
      </div>
    </main>
  );
}
