import { requireAdmin } from "@/lib/admin-auth";
import { listAdminUsers } from "@/lib/admin-users";
import { changeUserRole, inviteUser, toggleUserBlocked } from "./actions";
import { getSessionToken } from "@/lib/session";

function formatDate(value?: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("es-CL", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminUsersPage() {
  const admin = await requireAdmin("/admin/users");
  const sessionToken = await getSessionToken();
  if (!sessionToken) return null;

  let users;
  try {
    users = await listAdminUsers(sessionToken);
  } catch {
    return (
      <main className="admin-content">
        <div className="admin-error"><span className="section-tag">Identidad</span><h1>No fue posible consultar usuarios.</h1><p>El panel administrativo del backend no está disponible.</p></div>
      </main>
    );
  }

  return (
    <main className="admin-content">
      <div className="admin-title"><div><span className="section-tag">Identidad</span><h1>Usuarios</h1><p>{users.length} identidades registradas localmente.</p></div></div>
      <section className="admin-card">
        <div className="card-head"><div><span className="section-tag">Invitación</span><h2>Invitar cuenta</h2></div></div>
        <form className="account-form" action={inviteUser}>
          <label><span>Correo</span><input type="email" name="email" required maxLength={254} /></label>
          <button type="submit">Enviar invitación</button>
        </form>
      </section>
      <section className="admin-card admin-users">
        <div className="admin-users-head"><span>Usuario</span><span>Verificación</span><span>Sesiones</span><span>Último acceso</span><span>Rol</span><span>Estado</span><span>Acciones</span></div>
        {users.map((user) => (
          <div className="admin-user-row" key={user.id}>
            <div><strong>{user.email}</strong><code>{user.id}</code></div>
            <span>{user.email_verified_at ? "Verificado" : "Pendiente"}</span>
            <span>{user.active_sessions}</span>
            <time>{formatDate(user.last_login_at)}</time>
            <span>{user.global_role === "admin" ? "Admin" : "Usuario"}</span>
            <span className={user.blocked_at ? "admin-status error" : "admin-status"}>{user.blocked_at ? "Bloqueado" : "Activo"}</span>
            <div className="admin-user-actions">
              {user.id !== admin.id && (
                <form action={toggleUserBlocked}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="blocked" value={String(!user.blocked_at)} />
                  <button type="submit">{user.blocked_at ? "Desbloquear" : "Bloquear"}</button>
                </form>
              )}
              {user.id !== admin.id && (
                <form action={changeUserRole}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input type="hidden" name="role" value={user.global_role === "admin" ? "user" : "admin"} />
                  <button type="submit">{user.global_role === "admin" ? "Quitar admin" : "Hacer admin"}</button>
                </form>
              )}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
