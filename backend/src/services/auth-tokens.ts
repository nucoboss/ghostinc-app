import { db } from "../db.js";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, normalizeEmail } from "./auth-crypto.js";

const TOKEN_TTL_MINUTES = 30;
const TOKEN_LIFETIME_MS = TOKEN_TTL_MINUTES * 60 * 1000;

export type TokenPurpose = "registration" | "password_reset";

export class TokenError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export async function createInitialAdminInvite(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ghostinc-initial-admin'))");
    const existingAdmin = await client.query(
      "SELECT 1 FROM users WHERE global_role = 'admin' LIMIT 1",
    );
    if (existingAdmin.rowCount) throw new TokenError("ADMIN_ALREADY_EXISTS");
    const existingIdentity = await client.query(
      "SELECT 1 FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [normalizedEmail],
    );
    if (existingIdentity.rowCount) throw new TokenError("IDENTITY_ALREADY_EXISTS");

    const user = await client.query<{ id: string }>(
      "INSERT INTO users (email, global_role) VALUES ($1, 'admin') RETURNING id",
      [normalizedEmail],
    );
    const userId = user.rows[0]!.id;
    await client.query(
      "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'registration', $2, $3)",
      [userId, tokenHash, expiresAt],
    );
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'admin_invitation_created')",
      [userId],
    );
    await client.query("COMMIT");
    return { token, userId, expiresAt, email: normalizedEmail };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function userByIdentity(email: string) {
  const result = await db.query<{
    id: string;
    password_hash: string | null;
    blocked_at: Date | null;
  }>(
    "SELECT id, password_hash, blocked_at FROM users WHERE lower(email) = lower($1)",
    [normalizeEmail(email)],
  );
  return result.rows[0];
}

export async function issueAuthToken(email: string, purpose: TokenPurpose, actorUserId?: string) {
  const user = await userByIdentity(email);

  if (purpose === "password_reset" && !user?.password_hash) return null;
  if (purpose === "registration" && user?.password_hash) return null;
  if (user?.blocked_at) return null;

  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + TOKEN_LIFETIME_MS);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const userId = user?.id ?? (await client.query<{ id: string }>(
      "INSERT INTO users (email) VALUES ($1) RETURNING id",
      [normalizeEmail(email)],
    )).rows[0]!.id;

    await client.query(
      "UPDATE auth_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL",
      [userId, purpose],
    );
    await client.query(
      "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
      [userId, purpose, tokenHash, expiresAt],
    );
    await client.query(
      "INSERT INTO auth_events (user_id, actor_user_id, event_type) VALUES ($1, $2, $3)",
      [
        userId,
        actorUserId ?? null,
        actorUserId && purpose === "registration"
          ? "admin_invitation_created"
          : purpose === "registration"
            ? "registration_requested"
            : "password_reset_requested",
      ],
    );
    await client.query("COMMIT");
    return { token, userId, expiresAt, email: normalizeEmail(email) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeAuthToken(token: string, password: string) {
  const tokenHash = hashOpaqueToken(token);
  const passwordHash = await hashPassword(password);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{
      id: string;
      user_id: string;
      purpose: TokenPurpose;
      expires_at: Date;
      used_at: Date | null;
      blocked_at: Date | null;
    }>(
      `SELECT t.id, t.user_id, t.purpose, t.expires_at, t.used_at, u.blocked_at
       FROM auth_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $1
       FOR UPDATE OF t, u`,
      [tokenHash],
    );
    const row = result.rows[0];
    if (!row || row.used_at || row.blocked_at) {
      await client.query("ROLLBACK");
      throw new TokenError("TOKEN_INVALID");
    }
    if (row.expires_at.getTime() < Date.now()) {
      await client.query("ROLLBACK");
      throw new TokenError("TOKEN_EXPIRED");
    }

    const userId = row.user_id;
    const updated = await client.query(
      `UPDATE users
       SET password_hash = $2,
           password_changed_at = now(),
           email_verified_at = COALESCE(email_verified_at, now())
       WHERE id = $1`,
      [userId, passwordHash],
    );
    if (!updated.rowCount) throw new Error("USER_NOT_FOUND");
    await client.query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    await client.query("UPDATE auth_tokens SET used_at = now() WHERE id = $1", [row.id]);
    await client.query(
      `INSERT INTO auth_events (user_id, actor_user_id, event_type)
       VALUES ($1, $1, 'password_changed'), ($1, NULL, 'token_consumed')`,
      [userId],
    );
    await client.query("COMMIT");
  } catch (error) {
    if (!(error instanceof TokenError)) await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
