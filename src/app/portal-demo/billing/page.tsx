const movements = [
  ["Recarga", "+5.000", "Confirmada", "15 jul 2026", "pay_demo_81c2"],
  ["Uso API", "-1", "Aplicado", "30 jul 2026", "req_8fd2a1"],
  ["Compensación", "+1", "Aplicada", "30 jul 2026", "req_3d18c7"],
];

export default function PortalDemoBillingPage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Créditos y pagos</span><h1>Saldo e historial</h1><p>Paquetes prepagados, acumulables y sin vencimiento.</p></div><button className="button-primary" disabled>Comprar créditos</button></div>
      <section className="credit-balance"><div><span>Saldo disponible</span><strong>2.450 créditos</strong><small>Saldo ficticio para visualizar el portal.</small></div><div className="balance-ring"><span>Demo</span></div></section>
      <section className="dashboard-card table-card" style={{ marginTop: 12 }}>
        <div className="activity-table-head"><span>Movimiento</span><span>Créditos</span><span>Estado</span><span>Fecha</span><span>Referencia</span></div>
        {movements.map((movement) => <div className="activity-table-row" key={movement[4]}>{movement.map((value, index) => index === 4 ? <code key={value}>{value}</code> : <span key={value}>{value}</span>)}</div>)}
      </section>
      <section className="dashboard-card billing-settings"><div><h2>Compra puntual</h2><p>El catálogo mostrará paquetes y precios definidos por servidor. La demo no fija montos ni condiciones comerciales.</p></div><button className="button-secondary" disabled>Ver paquetes</button></section>
      <p className="placeholder-notice">Movimientos ficticios. Ningún pago se inicia ni acredita desde esta vista.</p>
    </main>
  );
}
