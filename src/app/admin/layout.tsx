import type { Metadata } from "next";
import Link from "next/link";
import { GhostIcon } from "@/components/ghost-icon";
import { LogoutButton } from "@/components/logout-button";
import { requireAdmin } from "@/lib/admin-auth";
import { SessionRefresh } from "@/components/session-refresh";

export const metadata: Metadata = { title: "Administración | Ghostinc" };
export const dynamic = "force-dynamic";

const links = [
  ["Monitoreo", "/admin"],
  ["Usuarios", "/admin/users"],
  ["Cuentas", "/admin/accounts"],
];

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const user = await requireAdmin();
  return (
    <div className="admin-shell">
      <SessionRefresh />
      <aside className="admin-sidebar">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="admin-label">Control plane</div>
        <nav aria-label="Administración">
          {links.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="admin-identity">
          <span>Administrador</span>
          <strong>{user.email}</strong>
          <LogoutButton className="account-reauth" />
        </div>
      </aside>
      <div className="admin-main">{children}</div>
    </div>
  );
}
