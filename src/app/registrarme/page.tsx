import type { Metadata } from "next";
import Link from "next/link";
import { AccountDataScene } from "@/components/account-data-scene";
import { EmailForm } from "@/components/email-form";
import { GhostIcon } from "@/components/ghost-icon";

export const metadata: Metadata = {
  title: "Crear cuenta | Ghostinc",
};
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <main className="account-page">
      <section className="account-panel">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="account-copy">
          <span className="section-tag">Ghostinc API</span>
          <h1>Crea tu cuenta</h1>
          <p>Recibirás un enlace de un solo uso para definir tu contraseña.</p>
        </div>
        <EmailForm
          endpoint="/api/auth/register"
          submitLabel="Enviarme el enlace"
          successText="Si el correo existe, recibirás un enlace para crear tu contraseña. Revisa también la carpeta de spam."
          heading="El enlace expira en 30 minutos."
        />
        <p className="auth-config-note">¿Ya tienes cuenta? <Link href="/auth/login">Ingresa aquí</Link>.</p>
      </section>
      <aside className="account-aside">
        <AccountDataScene />
      </aside>
    </main>
  );
}