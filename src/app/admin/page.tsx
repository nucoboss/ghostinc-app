import { getAdminOverview } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/admin-auth";
import { getSessionToken } from "@/lib/session";

function formatTime(value: string) {
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminPage() {
  await requireAdmin("/admin");
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;

  let overview;
  try {
    overview = await getAdminOverview(sessionToken);
  } catch {
    return <AdminDataUnavailable />;
  }

  const successRate = overview.metrics.requests_24h === 0
    ? 100
    : ((overview.metrics.requests_24h - overview.metrics.errors_24h) / overview.metrics.requests_24h) * 100;

  return (
    <main className="admin-content">
      <div className="admin-title"><div><span className="section-tag">Monitoreo</span><h1>Estado operativo</h1><p>Actividad real registrada por el backend.</p></div><span className="admin-live"><i />En línea</span></div>
      <div className="admin-metrics">
        <article><span>Solicitudes · 24h</span><strong>{overview.metrics.requests_24h.toLocaleString("es-CL")}</strong><small>{overview.metrics.credits_24h} créditos cobrados</small></article>
        <article><span>Tasa de éxito</span><strong>{successRate.toFixed(1)}%</strong><small>{overview.metrics.errors_24h} errores</small></article>
        <article><span>Cuentas</span><strong>{overview.metrics.users.toLocaleString("es-CL")}</strong><small>{overview.metrics.active_keys} API keys activas</small></article>
        <article><span>Créditos disponibles</span><strong>{overview.metrics.available_credits.toLocaleString("es-CL")}</strong><small>Saldo agregado</small></article>
      </div>
      <section className="admin-card">
        <div className="admin-card-head"><div><span className="section-tag">Tiempo real</span><h2>Solicitudes recientes</h2></div><span>Últimas 20</span></div>
        <div className="admin-activity-head"><span>Request ID</span><span>Cuenta</span><span>Clave</span><span>Estado</span><span>Latencia</span><span>Fecha</span></div>
        {overview.activity.map((request) => (
          <div className="admin-activity-row" key={request.request_id}>
            <code>{request.request_id}</code><span>{request.account}</span><span>{request.key_name ?? "Revocada"}</span><span className={request.status_code >= 400 ? "admin-status error" : "admin-status"}>{request.status_code}</span><span>{request.duration_ms} ms</span><time>{formatTime(request.created_at)}</time>
          </div>
        ))}
        {overview.activity.length === 0 && <p className="admin-empty">Todavía no hay solicitudes comerciales registradas.</p>}
      </section>
    </main>
  );
}

function AdminDataUnavailable() {
  return (
    <main className="admin-content">
      <div className="admin-error"><span className="section-tag">Backend no disponible</span><h1>No fue posible cargar las métricas.</h1><p>Comprueba `INTERNAL_SERVICE_TOKEN` y el estado del servicio backend.</p></div>
    </main>
  );
}
