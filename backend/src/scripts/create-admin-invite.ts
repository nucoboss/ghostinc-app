import { db } from "../db.js";
import { generateOpaqueToken, normalizeEmail } from "../services/auth-crypto.js";

const email = normalizeEmail(process.env.ADMIN_EMAIL ?? "");
const appBaseUrl = process.env.APP_BASE_URL;

if (!email || !email.includes("@")) throw new Error("Define ADMIN_EMAIL con una dirección válida.");
if (!appBaseUrl) throw new Error("Define APP_BASE_URL para construir la invitación.");

const invite = generateOpaqueToken();
const expiresAt = new Date(Date.now() + 30 * 60_000);
const client = await db.connect();

try {
  await client.query("BEGIN");
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) FOR UPDATE",
    [email],
  );
  const userId = existing.rows[0]?.id ?? (await client.query<{ id: string }>(
    "INSERT INTO users (email, global_role) VALUES ($1, 'admin') RETURNING id",
    [email],
  )).rows[0]!.id;

  if (existing.rowCount) {
    await client.query(
      "UPDATE users SET global_role = 'admin' WHERE id = $1",
      [userId],
    );
    await client.query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
  }

  await client.query(
    "UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = 'registration' AND used_at IS NULL",
    [userId],
  );
  await client.query(
    "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'registration', $2, $3)",
    [userId, invite.tokenHash, expiresAt],
  );
  await client.query(
    "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'admin_invitation_created')",
    [userId],
  );
  await client.query("COMMIT");

  const invitationUrl = new URL("/crear-contrasena", appBaseUrl);
  invitationUrl.hash = new URLSearchParams({ token: invite.token, mode: "registration" }).toString();
  console.log("Invitación administrativa creada. Se muestra una sola vez:");
  console.log(invitationUrl.toString());
  console.log(`Expira: ${expiresAt.toISOString()}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
