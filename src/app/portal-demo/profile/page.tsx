import Link from "next/link";

export default function PortalDemoProfilePage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Cuenta individual</span><h1>Mi cuenta</h1><p>Identidad, seguridad y accesos de una cuenta ficticia.</p></div></div>

      <section className="account-profile-summary">
        <div className="account-avatar" aria-hidden="true">C</div>
        <div><span>Cliente API</span><h2>Camila Soto</h2><p>camila@empresa-demo.cl</p></div>
        <span className="account-verified">Correo verificado</span>
      </section>

      <div className="account-security-grid">
        <section className="dashboard-card account-security-card">
          <div className="account-card-heading"><div><span className="section-tag">Acceso</span><h2>Correo y contraseña</h2></div><span className="account-security-state active">Activo</span></div>
          <p>La recuperación se gestiona mediante el proveedor de identidad sin exponer si una cuenta existe.</p>
          <small>Último acceso ficticio: hoy, 09:42</small>
          <button className="button-secondary" disabled>Enviar recuperación</button>
        </section>
        <section className="dashboard-card account-security-card">
          <div className="account-card-heading"><div><span className="section-tag">Segundo factor</span><h2>Aplicación autenticadora</h2></div><span className="account-security-state">Opcional</span></div>
          <p>La cuenta puede protegerse con códigos temporales TOTP desde una aplicación autenticadora.</p>
          <small>Estado ficticio: no configurado</small>
          <button className="button-secondary" disabled>Configurar TOTP</button>
        </section>
      </div>

      <div className="account-links-grid">
        <Link className="dashboard-card account-link-card" href="/portal-demo/billing"><span className="section-tag">Facturación</span><h2>Créditos y pagos</h2><p>Consulta el saldo y el historial demostrativo.</p><strong>Ver créditos →</strong></Link>
        <Link className="dashboard-card account-link-card" href="/portal-demo/keys"><span className="section-tag">Acceso API</span><h2>Credenciales</h2><p>Revisa claves separadas por integración.</p><strong>Ver API keys →</strong></Link>
      </div>
      <p className="placeholder-notice">Todos los datos de identidad son ficticios y las acciones están deshabilitadas.</p>
    </main>
  );
}
