export default function KeysPage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Seguridad</span><h1>API keys</h1><p>Usa una credencial distinta por aplicación y entorno.</p></div><button className="button-primary" disabled>Crear API key</button></div>
      <section className="dashboard-card table-card">
        <div className="key-table-head"><span>Nombre</span><span>Credencial</span><span>Último uso</span><span>Estado</span></div>
        <div className="key-table-row"><strong>Producción</strong><code>pjud_live_••••••8f21</code><span>Hace 3 minutos</span><span className="status-pill">Activa</span></div>
        <div className="key-table-row"><strong>Desarrollo</strong><code>pjud_test_••••••1ac4</code><span>Ayer, 18:42</span><span className="status-pill">Activa</span></div>
      </section>
      <section className="dashboard-card security-callout"><div><span className="section-tag">Integración pendiente</span><h2>Emisión segura de credenciales</h2><p>La clave completa se mostrará una sola vez. El servidor almacenará únicamente su hash y permitirá rotación, vencimiento y revocación.</p></div><button disabled>Configurar al integrar auth</button></section>
    </main>
  );
}
