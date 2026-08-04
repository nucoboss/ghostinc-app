import { db } from "../db.js";
import { normalizeEmail } from "../services/auth-crypto.js";
import { resetAdminMfa } from "../services/auth-mfa.js";

const email = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
const reason = (process.env.RESET_REASON ?? "").trim();
const actor = process.env.RESET_ACTOR ?? "cli";

if (!email || !email.includes("@")) throw new Error("Define ADMIN_EMAIL con una dirección válida.");
if (reason.length < 20) {
  throw new Error("Define RESET_REASON con el motivo explícito (mínimo 20 caracteres) para auditar el reset.");
}

const target = await db.query<{ id: string; global_role: string; email: string }>(
  "SELECT id, global_role, email FROM users WHERE lower(email) = lower($1)",
  [email],
);
const admin = target.rows[0];
if (!admin || admin.global_role !== "admin") {
  throw new Error("El usuario indicado no existe o no es administrador.");
}

const revoked = await resetAdminMfa(admin.id, actor, reason);
console.log(`MFA administrativo restablecido para ${admin.email}.`);
console.log(`Motivo auditado: ${reason}`);
console.log(`Sesiones revocadas: ${revoked}`);
console.log("El administrador debe iniciar sesión de nuevo y enrolar TOTP.");
await db.end();