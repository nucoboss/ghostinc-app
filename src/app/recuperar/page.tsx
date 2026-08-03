import type { Metadata } from "next";
import Link from "next/link";
import { AccountDataScene } from "@/components/account-data-scene";
import { EmailForm } from "@/components/email-form";
import { GhostIcon } from "@/components/ghost-icon";

export const metadata: Metadata = {
  title: "Recuperar contraseña | Ghostinc",
};
export const dynamic = "force-dynamic";

export default function RecoveryPage() {
  return (
    <main className="account-page">
      <section className="account-panel">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="account-copy">
          <span className="section-tag">Ghostinc API</span>
          <h1>Recupera tu contraseña</h1>
          <p>Te enviaremos un enlace de un solo uso para establecer una nueva contraseña.</p>
        </div>
        <EmailForm
          endpoint="/api/auth/recovery"
          submitLabel="Enviarme el enlace"
          successText="Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam."
          heading="El enlace expira en 30 minutos y revoca las sesiones activas."
        />
        <p className="auth-config-note">¿Ya tienes cuenta? <Link href="/auth/login">Ingresa aquí</Link>.</p>
      </section>
      <aside className="account-aside">
        <AccountDataScene />
      </aside>
    </main>
  );
}