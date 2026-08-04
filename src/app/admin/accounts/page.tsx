import { getAdminOverview } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/admin-auth";
import { getSessionToken } from "@/lib/session";

export default async function AdminAccountsPage() {
  await requireAdmin("/admin/accounts");
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;

  const overview = await getAdminOverview(sessionToken);
  return (
    <main className="admin-content">
      <div className="admin-title"><div><span className="section-tag">Clientes API</span><h1>Cuentas</h1><p>Saldos, credenciales y actividad comercial por usuario.</p></div></div>
      <section className="admin-card admin-organizations">
        <div className="admin-org-head"><span>Cuenta</span><span>Créditos</span><span>API keys</span><span>Solicitudes · 30d</span><span>Creada</span></div>
        {overview.accounts.map((account) => (
          <div className="admin-org-row" key={account.id}>
            <div><strong>{account.email}</strong><code>{account.id}</code></div>
            <span>{account.credit_balance.toLocaleString("es-CL")}</span>
            <span>{account.api_keys}</span>
            <span>{account.requests_30d.toLocaleString("es-CL")}</span>
            <time>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(account.created_at))}</time>
          </div>
        ))}
      </section>
    </main>
  );
}