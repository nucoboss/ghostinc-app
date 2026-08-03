const events = [
  ["req_8fd2a1", "GET /causas/rut/:rut", "200", "248 ms", "1 crédito"],
  ["req_17bc42", "GET /causas/rut/:rut", "200", "315 ms", "1 crédito"],
  ["req_a60f9e", "GET /causas/rut/:rut", "400", "42 ms", "0 créditos"],
  ["req_3d18c7", "GET /causas/rut/:rut", "502", "1.240 ms", "0 créditos"],
];

export default function PortalDemoUsagePage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Observabilidad</span><h1>Consumo y actividad</h1><p>Solicitudes, errores, latencia y créditos sin registrar el RUT consultado.</p></div><button className="button-secondary" disabled>Exportar CSV</button></div>
      <div className="dashboard-metrics compact"><article><span>Solicitudes</span><strong>2.550</strong></article><article><span>Créditos usados</span><strong>2.550</strong></article><article><span>Errores</span><strong>20</strong></article><article><span>Rate limit</span><strong>60/min</strong></article></div>
      <section className="dashboard-card table-card">
        <div className="activity-table-head"><span>Request ID</span><span>Endpoint</span><span>Estado</span><span>Latencia</span><span>Costo</span></div>
        {events.map((event) => <div className="activity-table-row" key={event[0]}>{event.map((value, index) => index === 0 ? <code key={value}>{value}</code> : <span key={value}>{value}</span>)}</div>)}
      </section>
      <p className="placeholder-notice">Actividad ficticia. Las solicitudes inválidas o incompletas no consumen créditos.</p>
    </main>
  );
}
