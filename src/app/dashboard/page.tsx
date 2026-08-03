import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (session?.globalRole === "admin") redirect("/admin");

  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Resumen</span><h1>Buenos días, {session?.email.split("@")[0]}</h1><p>Actividad simulada de tu organización durante los últimos 30 días.</p></div><Link className="button-primary" href="/dashboard/playground">Nueva consulta</Link></div>
      <div className="dashboard-metrics">
        <article><span>Créditos disponibles</span><strong>2.450</strong><small>de 5.000 mensuales</small></article>
        <article><span>Consultas este mes</span><strong>2.550</strong><small>+12,4% vs. período anterior</small></article>
        <article><span>Tasa de éxito</span><strong>99,2%</strong><small>20 solicitudes con error</small></article>
        <article><span>Latencia mediana</span><strong>284 ms</strong><small>p95 · 710 ms</small></article>
      </div>
      <div className="dashboard-grid">
        <section className="dashboard-card usage-chart">
          <div className="card-head"><div><span className="section-tag">Consumo</span><h2>Últimos 14 días</h2></div><Link href="/dashboard/usage">Ver detalle</Link></div>
          <div className="bar-chart" aria-label="Gráfico demostrativo de consumo">
            {[42, 65, 48, 76, 58, 84, 72, 91, 54, 68, 88, 63, 79, 96].map((height, index) => <span style={{ height: `${height}%` }} key={index} />)}
          </div>
          <div className="chart-axis"><span>17 jul</span><span>30 jul</span></div>
        </section>
        <section className="dashboard-card">
          <div className="card-head"><div><span className="section-tag">Credenciales</span><h2>API keys</h2></div><Link href="/dashboard/keys">Administrar</Link></div>
          <div className="key-summary"><span className="key-icon">K</span><div><strong>Producción</strong><code>pjud_live_••••••8f21</code></div><small>Usada hace 3 min</small></div>
          <div className="key-summary"><span className="key-icon muted">K</span><div><strong>Desarrollo</strong><code>pjud_test_••••••1ac4</code></div><small>Usada ayer</small></div>
        </section>
      </div>
      <p className="placeholder-notice">Datos demostrativos. Las métricas reales estarán disponibles al conectar autenticación, billing y telemetría.</p>
    </main>
  );
}
