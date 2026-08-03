import { db } from "../db.js";
import { config } from "../config.js";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, normalizeEmail, verifyPassword } from "./auth-crypto.js";

export type SessionPolicy = {
  absoluteSeconds: number;
  inactivitySeconds: number;
  rotationSeconds: number;
};

export type SessionUser = {
  id: string;
  email: string;
  globalRole: "user" | "admin";
  emailVerified: boolean;
};

type SessionRow = {
  id: string;
  user_id: string;
  auth_level: string;
  created_at: Date;
  last_seen_at: Date;
  rotated_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  email: string;
  global_role: "user" | "admin";
  email_verified_at: Date | null;
};

export type SessionResult =
  | { kind: "ok"; user: SessionUser; token?: string }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "blocked" };

const INVALID_CREDENTIALS = "Credenciales inválidas.";
const dummyPasswordHash = hashPassword("ghostinc-dummy-password-not-for-login");

export class LoginFailedError extends Error {}

export function defaultSessionPolicy(): SessionPolicy {
  return config.sessionPolicy;
}

function toSessionUser(row: SessionRow): SessionUser {
  return {
    id: row.user_id,
    email: row.email,
    globalRole: row.global_role,
    emailVerified: Boolean(row.email_verified_at),
  };
}

async function recordEvent(eventType: string, userId?: string, actorUserId?: string) {
  await db.query(
    "INSERT INTO auth_events (user_id, actor_user_id, event_type) VALUES ($1, $2, $3)",
    [userId ?? null, actorUserId ?? null, eventType],
  );
}

export async function loginUser(
  email: string,
  password: string,
  policy: SessionPolicy = defaultSessionPolicy(),
): Promise<{ token: string; user: SessionUser }> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail.includes("@") || normalizedEmail.length > 254 || !password) {
    throw new LoginFailedError(INVALID_CREDENTIALS);
  }

  const result = await db.query<{
    id: string;
    password_hash: string | null;
    blocked_at: Date | null;
    global_role: "user" | "admin";
    email_verified_at: Date | null;
    email: string;
  }>(
    `SELECT id, password_hash, blocked_at, global_role, email_verified_at, email
     FROM users
     WHERE lower(email) = $1`,
    [normalizedEmail],
  );

  const user = result.rows[0];
  const passwordHash = user?.password_hash ?? await dummyPasswordHash;
  const verified = await verifyPassword(passwordHash, password);

  if (!user || !verified || user.blocked_at) {
    await recordEvent("login_failed", user?.id);
    throw new LoginFailedError(INVALID_CREDENTIALS);
  }

  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + policy.inactivitySeconds * 1000);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, auth_level, expires_at)
       VALUES ($1, $2, 'password', $3)`,
      [user.id, tokenHash, expiresAt],
    );
    await client.query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'login')",
      [user.id],
    );
    await client.query("COMMIT");
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        globalRole: user.global_role,
        emailVerified: Boolean(user.email_verified_at),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkSession(
  token: string,
  policy: SessionPolicy = defaultSessionPolicy(),
  rotate = false,
): Promise<SessionResult> {
  if (!token || token.length > 128) return { kind: "invalid" };
  const tokenHash = hashOpaqueToken(token);

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<SessionRow>(
      `SELECT s.id, s.user_id, s.auth_level, s.created_at, s.last_seen_at, s.rotated_at, s.expires_at, s.revoked_at,
              u.email, u.global_role, u.email_verified_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
       FOR UPDATE OF s`,
      [tokenHash],
    );
    const session = result.rows[0];
    if (!session || session.revoked_at) {
      await client.query("COMMIT");
      return { kind: "invalid" };
    }

    const now = Date.now();
    const expired = now >= session.expires_at.getTime()
      || now - session.created_at.getTime() >= policy.absoluteSeconds * 1000
      || now - session.last_seen_at.getTime() >= policy.inactivitySeconds * 1000;

    if (expired) {
      await client.query(
        "UPDATE auth_sessions SET revoked_at = now() WHERE id = $1",
        [session.id],
      );
      await client.query(
        "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'session_expired')",
        [session.user_id],
      );
      await client.query("COMMIT");
      return { kind: "expired" };
    }

    const blocked = await client.query<{ blocked_at: Date | null }>(
      "SELECT blocked_at FROM users WHERE id = $1",
      [session.user_id],
    );
    if (blocked.rows[0]?.blocked_at) {
      await client.query(
        "UPDATE auth_sessions SET revoked_at = now() WHERE id = $1",
        [session.id],
      );
      await client.query(
        "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'session_revoked_blocked')",
        [session.user_id],
      );
      await client.query("COMMIT");
      return { kind: "blocked" };
    }

    const shouldRotate = rotate
      && now - session.rotated_at.getTime() >= policy.rotationSeconds * 1000;

    let newToken: string | undefined;
    if (shouldRotate) {
      const rotated = generateOpaqueToken();
      newToken = rotated.token;
      const refreshedAt = new Date(now);
      const expiresAt = new Date(Math.min(
        session.created_at.getTime() + policy.absoluteSeconds * 1000,
        now + policy.inactivitySeconds * 1000,
      ));
      await client.query(
       `UPDATE auth_sessions
          SET token_hash = $2, last_seen_at = $3, rotated_at = $3, expires_at = $4
         WHERE id = $1`,
        [session.id, rotated.tokenHash, refreshedAt, expiresAt],
      );
    } else {
      const refreshedAt = new Date(now);
      const expiresAt = new Date(Math.min(
        session.created_at.getTime() + policy.absoluteSeconds * 1000,
        now + policy.inactivitySeconds * 1000,
      ));
      await client.query(
        "UPDATE auth_sessions SET last_seen_at = $2, expires_at = $3 WHERE id = $1",
        [session.id, refreshedAt, expiresAt],
      );
    }

    await client.query("COMMIT");
    return {
      kind: "ok",
      user: toSessionUser(session),
      ...(newToken ? { token: newToken } : {}),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeSession(token: string): Promise<void> {
  if (!token || token.length > 128) return;
  const tokenHash = hashOpaqueToken(token);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<{ user_id: string }>(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id`,
      [tokenHash],
    );
    if (result.rows[0]) {
      await client.query(
        "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'logout')",
        [result.rows[0].user_id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
