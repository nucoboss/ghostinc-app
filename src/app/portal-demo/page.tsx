import Link from "next/link";

export default function PortalDemoPage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title">
        <div>
          <span className="section-tag">Resumen</span>
          <h1>Portal de usuario</h1>
          <p>Recorre una cuenta ficticia con métricas, consumo, credenciales y créditos.</p>
        </div>
        <Link className="button-primary" href="/portal-demo/playground">Probar API demo</Link>
      </div>

      <div className="dashboard-metrics">
        <article><span>Créditos disponibles</span><strong>2.450</strong><small>saldo ficticio</small></article>
        <article><span>Consultas este mes</span><strong>2.550</strong><small>+12,4% vs. período anterior</small></article>
        <article><span>Tasa de éxito</span><strong>99,2%</strong><small>20 solicitudes con error</small></article>
        <article><span>Latencia mediana</span><strong>284 ms</strong><small>p95 · 710 ms</small></article>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card usage-chart">
          <div className="card-head">
            <div><span className="section-tag">Consumo</span><h2>Últimos 14 días</h2></div>
            <Link href="/portal-demo/usage">Ver detalle</Link>
          </div>
          <div className="bar-chart" aria-label="Gráfico demostrativo de consumo">
            {[42, 65, 48, 76, 58, 84, 72, 91, 54, 68, 88, 63, 79, 96].map((height, index) => (
              <span style={{ height: `${height}%` }} key={index} />
            ))}
          </div>
          <div className="chart-axis"><span>17 jul</span><span>30 jul</span></div>
        </section>

        <section className="dashboard-card">
          <div className="card-head">
            <div><span className="section-tag">Credenciales</span><h2>API keys</h2></div>
            <Link href="/portal-demo/keys">Ver credenciales</Link>
          </div>
          <div className="key-summary"><span className="key-icon">K</span><div><strong>Producción</strong><code>gh_live_••••••8f21</code></div><small>Hace 3 min</small></div>
          <div className="key-summary"><span className="key-icon muted">K</span><div><strong>Desarrollo</strong><code>gh_test_••••••1ac4</code></div><small>Ayer</small></div>
        </section>
      </div>

      <p className="placeholder-notice">Vista estática con datos ficticios. No representa una cuenta real ni ejecuta acciones comerciales.</p>
    </main>
  );
}
