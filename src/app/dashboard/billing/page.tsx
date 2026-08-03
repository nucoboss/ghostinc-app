const packs = [
  ["Inicio", "1.000", "Para pruebas e integraciones pequeñas"],
  ["Operación", "10.000", "Para flujos recurrentes de compliance"],
  ["Escala", "50.000", "Para alto volumen y múltiples sistemas"],
];

export default function BillingPage() {
  return (
    <main className="dashboard-content">
      <div className="dashboard-title"><div><span className="section-tag">Billing</span><h1>Créditos y pagos</h1><p>Compra capacidad adicional y controla la recarga automática.</p></div></div>
      <section className="credit-balance"><div><span>Saldo disponible</span><strong>2.450 créditos</strong><small>La próxima renovación está pendiente de configurar.</small></div><div className="balance-ring"><span>49%</span></div></section>
      <div className="credit-packs">
        {packs.map(([name, credits, description]) => <article key={name}><span className="section-tag">{name}</span><h2>{credits}</h2><strong>créditos</strong><p>{description}</p><span className="price-placeholder">Precio por definir</span><button disabled>Comprar</button></article>)}
      </div>
      <section className="dashboard-card billing-settings"><div><h2>Recarga automática</h2><p>Recarga créditos cuando el saldo baje del umbral configurado.</p></div><button className="toggle-placeholder" type="button" disabled aria-label="Recarga automática deshabilitada"><span /></button></section>
      <p className="placeholder-notice">Checkout, documentos tributarios y webhooks de pago requieren definir el proveedor de pagos.</p>
    </main>
  );
}
