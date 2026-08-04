import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSession, type SessionUser } from "./session";

export async function requireAdmin(returnTo = "/admin"): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (session.globalRole !== "admin") redirect("/acceso-denegado");
  return session;
}
