import { db } from "../db.js";
import { normalizeEmail } from "../services/auth-crypto.js";
import { createInitialAdminInvite } from "../services/auth-tokens.js";

const email = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
const appBaseUrl = process.env.APP_BASE_URL;

if (!email || !email.includes("@")) throw new Error("Define ADMIN_EMAIL con una dirección válida.");
if (!appBaseUrl) throw new Error("Define APP_BASE_URL para construir la invitación.");

try {
  const invite = await createInitialAdminInvite(email);

  const invitationUrl = new URL("/crear-contrasena", appBaseUrl);
  invitationUrl.hash = new URLSearchParams({ token: invite.token, mode: "registration" }).toString();
  console.log("Invitación administrativa creada. Se muestra una sola vez:");
  console.log(invitationUrl.toString());
  console.log(`Expira: ${invite.expiresAt.toISOString()}`);
} finally {
  await db.end();
}
