import type { Metadata } from "next";
import Link from "next/link";
import { AccountDataScene } from "@/components/account-data-scene";
import { GhostIcon } from "@/components/ghost-icon";

export const metadata: Metadata = {
  title: "Cuenta API | Ghostinc",
};
export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <main className="account-page">
      <section className="account-panel">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="account-copy">
          <span className="section-tag">Ghostinc API</span>
          <h1>Accede a tu portal</h1>
          <p>Administra credenciales, créditos, facturación y consumo desde una cuenta segura.</p>
        </div>
        <div className="account-auth-actions">
          <span className="account-action-label">Usuarios registrados</span>
          <Link className="button-primary" href="/auth/login?returnTo=/dashboard">Ingresar a mi cuenta</Link>
          <div className="account-divider"><span>Crear cuenta nueva</span></div>
          <Link className="button-secondary" href="/registrarme">Registrarme por correo</Link>
          <Link className="demo-link" href="/recuperar">¿Olvidaste tu contraseña?</Link>
        </div>
      </section>
      <aside className="account-aside">
        <AccountDataScene />
      </aside>
    </main>
  );
}
