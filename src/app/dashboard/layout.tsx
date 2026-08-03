import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GhostIcon } from "@/components/ghost-icon";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentSession } from "@/lib/session";
import { SessionRefresh } from "@/components/session-refresh";

export const metadata: Metadata = { title: "Portal API | Ghostinc" };

const navigation = [
  ["Resumen", "/dashboard"],
  ["Mi cuenta", "/dashboard/profile"],
  ["API keys", "/dashboard/keys"],
  ["Consumo", "/dashboard/usage"],
  ["Créditos y pagos", "/dashboard/billing"],
  ["Playground", "/dashboard/playground"],
];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getCurrentSession();
  if (!session) redirect("/auth/login?returnTo=/dashboard");
  const isAdmin = session.globalRole === "admin";
  const visibleNavigation = isAdmin ? [...navigation, ["Administración", "/admin"]] : navigation;

  return (
    <div className="dashboard-shell">
      <SessionRefresh />
      <aside className="dashboard-sidebar">
        <Link className="brand" href="/"><GhostIcon />Ghostinc</Link>
        <div className="demo-badge">Portal API</div>
        <nav aria-label="Portal API">
          {visibleNavigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="dashboard-org"><span>Usuario</span><strong>{session.email}</strong><small>{isAdmin ? "Administrador" : "Cuenta registrada"}</small></div>
      </aside>
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="status-dot" />API operativa</div>
          <LogoutButton />
        </header>
        {children}
      </div>
    </div>
  );
}
