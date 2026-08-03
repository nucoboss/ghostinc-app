import "server-only";
import { redirect } from "next/navigation";
import { getCurrentSession, type SessionUser } from "./session";
import { getAuth0UserRoles, isManagementConfigured } from "./auth0-management";

const rolesClaim = process.env.AUTH0_ROLES_CLAIM ?? "https://ghostinc.cl/roles";

export async function isAdminUser(user: Record<string, unknown>) {
  const claim = user[rolesClaim];
  const roles = Array.isArray(claim) ? claim.filter((role): role is string => typeof role === "string") : [];
  if (roles.includes("admin")) return true;

  const userId = typeof user.sub === "string" ? user.sub : null;
  if (!userId || !isManagementConfigured()) return false;
  const assignedRoles = await getAuth0UserRoles(userId);
  return assignedRoles.some((role) => role.name === "admin");
}

export async function requireAdmin(returnTo = "/admin"): Promise<SessionUser> {
  const session = await getCurrentSession();
  if (!session) redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (session.globalRole !== "admin") redirect("/acceso-denegado");
  return session;
}
