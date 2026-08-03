import { getAdminOverview } from "@/lib/admin-api";
import { requireAdmin } from "@/lib/admin-auth";
import { getSessionToken } from "@/lib/session";

export default async function AdminOrganizationsPage() {
  await requireAdmin("/admin/organizations");
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;

  const overview = await getAdminOverview(sessionToken);
  return (
    <main className="admin-content">
      <div className="admin-title"><div><span className="section-tag">Clientes API</span><h1>Organizaciones</h1><p>Saldos, credenciales y actividad comercial.</p></div></div>
      <section className="admin-card admin-organizations">
        <div className="admin-org-head"><span>Organización</span><span>Créditos</span><span>API keys</span><span>Solicitudes · 30d</span><span>Creada</span></div>
        {overview.organizations.map((organization) => (
          <div className="admin-org-row" key={organization.id}>
            <div><strong>{organization.name}</strong><code>{organization.id}</code></div>
            <span>{organization.credit_balance.toLocaleString("es-CL")}</span>
            <span>{organization.api_keys}</span>
            <span>{organization.requests_30d.toLocaleString("es-CL")}</span>
            <time>{new Intl.DateTimeFormat("es-CL", { dateStyle: "medium" }).format(new Date(organization.created_at))}</time>
          </div>
        ))}
      </section>
    </main>
  );
}
