export default function PortalDemoKeysPage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Seguridad</span><h1>API keys</h1><p>Una credencial distinta por aplicación y entorno.</p></div><button className="button-primary" disabled>Crear API key</button></div>
      <section className="dashboard-card table-card">
        <div className="key-table-head"><span>Nombre</span><span>Credencial</span><span>Último uso</span><span>Estado</span></div>
        <div className="key-table-row"><strong>Producción</strong><code>gh_live_••••••8f21</code><span>Hace 3 minutos</span><span className="status-pill">Activa</span></div>
        <div className="key-table-row"><strong>Desarrollo</strong><code>gh_test_••••••1ac4</code><span>Ayer, 18:42</span><span className="status-pill">Activa</span></div>
        <div className="key-table-row"><strong>Integración anterior</strong><code>gh_live_••••••742e</code><span>12 jul, 10:18</span><span className="status-pill">Revocada</span></div>
      </section>
      <section className="dashboard-card security-callout"><div><span className="section-tag">Ciclo de vida</span><h2>Creación, rotación y revocación</h2><p>La clave completa se muestra una sola vez. Después, el portal conserva únicamente prefijo, últimos caracteres y estado.</p></div><button disabled>Rotar credencial</button></section>
      <p className="placeholder-notice">Credenciales ficticias e inutilizables. Las acciones están deshabilitadas en la demo pública.</p>
    </main>
  );
}
