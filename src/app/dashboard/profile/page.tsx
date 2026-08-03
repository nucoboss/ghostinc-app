import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi cuenta | Ghostinc" };

export default async function ProfilePage() {
  const session = await getCurrentSession();
  if (!session) return null;

  const isAdmin = session.globalRole === "admin";
  const displayName = session.email.split("@")[0] ?? "Cuenta Ghostinc";

  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Cuenta individual</span><h1>Mi cuenta</h1><p>Identidad, seguridad y preferencias de acceso.</p></div></div>
      <section className="account-profile-summary">
        <div className="account-avatar" aria-hidden="true">{String(displayName).charAt(0).toUpperCase()}</div>
        <div><span>{isAdmin ? "Administrador Ghostinc" : "Cliente API"}</span><h2>{displayName}</h2><p>{session.email}</p></div>
        <span className={session.emailVerified ? "account-verified" : "account-verified pending"}>{session.emailVerified ? "Correo verificado" : "Verificación pendiente"}</span>
      </section>

      <section className="dashboard-card account-security-card">
        <div className="card-head"><div><span className="section-tag">Seguridad</span><h2>Métodos de acceso</h2></div></div>
        <div className="key-summary"><span className="key-icon">P</span><div><strong>Contraseña</strong><code>Argon2id</code></div><small>Protegida</small></div>
        <p className="placeholder-notice">La verificación en dos pasos (TOTP) y los códigos de recuperación estarán disponibles próximamente.</p>
      </section>

      <div className="account-links-grid">
        <Link className="dashboard-card account-link-card" href="/dashboard/billing"><span className="section-tag">Facturación</span><h2>Plan, créditos y pagos</h2><p>Consulta el estado comercial de tu cuenta individual.</p><strong>Ver facturación →</strong></Link>
        <Link className="dashboard-card account-link-card" href="/dashboard/keys"><span className="section-tag">Acceso API</span><h2>Credenciales</h2><p>Administra claves separadas para cada integración.</p><strong>Ver API keys →</strong></Link>
      </div>
    </main>
  );
}
