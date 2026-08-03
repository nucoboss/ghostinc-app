import type { Metadata } from "next";
import Link from "next/link";
import { AccountDataScene } from "@/components/account-data-scene";
import { GhostIcon } from "@/components/ghost-icon";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Ingresar | Ghostinc",
};

function validReturnTo(value: string | null | undefined): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  return (
    <main className="account-page">
      <section className="account-panel">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="account-copy">
          <span className="section-tag">Ghostinc API</span>
          <h1>Ingresa a tu portal</h1>
          <p>Usa el correo y la contraseña de tu cuenta para administrar credenciales, créditos y consumo.</p>
        </div>
        <LoginForm returnTo={validReturnTo(returnTo)} />
        <p className="auth-config-note">¿No tienes cuenta? <Link href="/registrarme">Crea una aquí</Link> · <Link href="/recuperar">¿Olvidaste tu contraseña?</Link></p>
        <Link className="button-secondary" href="/">Volver al inicio</Link>
      </section>
      <aside className="account-aside">
        <AccountDataScene />
      </aside>
    </main>
  );
}
