import { db } from "../db.js";
import { config } from "../config.js";
import { generateOpaqueToken, hashOpaqueToken, hashPassword, normalizeEmail, verifyPassword } from "./auth-crypto.js";

export type SessionPolicy = {
  absoluteSeconds: number;
  inactivitySeconds: number;
  rotationSeconds: number;
};

export type AuthLevel = "password" | "mfa" | "full";

export type SessionUser = {
  id: string;
  email: string;
  globalRole: "user" | "admin";
  emailVerified: boolean;
  authLevel: AuthLevel;
  mfaVerifiedAt: Date | null;
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
  mfa_verified_at: Date | null;
  email: string;
  global_role: "user" | "admin";
  email_verified_at: Date | null;
};

export type SessionResult =
  | { kind: "ok"; user: SessionUser; token?: string }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "blocked" };

export type LoginResult =
  | { kind: "authenticated"; token: string; user: SessionUser }
  | { kind: "mfa_required"; token: string; user: SessionUser; mfaEnrollmentRequired: boolean };

const INVALID_CREDENTIALS = "Credenciales inválidas.";
const dummyPasswordHash = hashPassword("ghostinc-dummy-password-not-for-login");

export class LoginFailedError extends Error {}
export class ReauthenticationError extends Error {}

export function defaultSessionPolicy(): SessionPolicy {
  return config.sessionPolicy;
}

function toSessionUser(row: SessionRow, authLevel: AuthLevel): SessionUser {
  return {
    id: row.user_id,
    email: row.email,
    globalRole: row.global_role,
    emailVerified: Boolean(row.email_verified_at),
    authLevel,
    mfaVerifiedAt: row.mfa_verified_at ?? null,
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
): Promise<LoginResult> {
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

  const mfaResult = await db.query<{ confirmed: boolean }>(
    "SELECT (confirmed_at IS NOT NULL) AS confirmed FROM totp_credentials WHERE user_id = $1",
    [user.id],
  );
  const totpEnabled = mfaResult.rows[0]?.confirmed ?? false;
  const mfaRequired = totpEnabled || user.global_role === "admin";

  const { token, tokenHash } = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + policy.inactivitySeconds * 1000);
  const authLevel: AuthLevel = mfaRequired ? "mfa" : "full";

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO auth_sessions (user_id, token_hash, auth_level, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [user.id, tokenHash, authLevel, expiresAt],
    );
    await client.query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'login')",
      [user.id],
    );
    await client.query("COMMIT");
    const sessionUser: SessionUser = {
      id: user.id,
      email: user.email,
      globalRole: user.global_role,
      emailVerified: Boolean(user.email_verified_at),
      authLevel,
      mfaVerifiedAt: null,
    };
    return mfaRequired
      ? { kind: "mfa_required", token, user: sessionUser, mfaEnrollmentRequired: !totpEnabled }
      : { kind: "authenticated", token, user: sessionUser };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function reauthenticateUser(userId: string, password: string): Promise<void> {
  const result = await db.query<{ password_hash: string | null; blocked_at: Date | null }>(
    "SELECT password_hash, blocked_at FROM users WHERE id = $1",
    [userId],
  );
  const user = result.rows[0];
  const passwordHash = user?.password_hash ?? await dummyPasswordHash;
  const verified = password.length <= 128 && await verifyPassword(passwordHash, password);
  if (!user || !verified || user.blocked_at) {
    await recordEvent("reauthentication_failed", userId);
    throw new ReauthenticationError("Credenciales inválidas.");
  }
  await recordEvent("reauthentication_succeeded", userId);
}

export async function verifyMfaChallenge(
  token: string,
  verify: (session: { userId: string; email: string; globalRole: "user" | "admin" }) => Promise<void>,
  policy: SessionPolicy = defaultSessionPolicy(),
): Promise<{ token: string; user: SessionUser }> {
  const tokenHash = hashOpaqueToken(token);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<SessionRow & { mfa_failed_attempts: number }>(
      `SELECT s.id, s.user_id, s.auth_level, s.created_at, s.last_seen_at, s.rotated_at, s.expires_at, s.revoked_at, s.mfa_verified_at, s.mfa_failed_attempts,
              u.email, u.global_role, u.email_verified_at
       FROM auth_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
       FOR UPDATE OF s`,
      [tokenHash],
    );
    const session = result.rows[0];
    if (!session || session.revoked_at || session.auth_level !== "mfa") {
      await client.query("COMMIT");
      throw new MfaChallengeError("INVALID_CHALLENGE");
    }
    const now = Date.now();
    const expired = now >= session.expires_at.getTime()
      || now - session.created_at.getTime() >= policy.absoluteSeconds * 1000
      || now - session.last_seen_at.getTime() >= policy.inactivitySeconds * 1000;
    if (expired) {
      await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE id = $1", [session.id]);
      await client.query("COMMIT");
      throw new MfaChallengeError("CHALLENGE_EXPIRED");
    }

    let verified = false;
    try {
      await verify({
        userId: session.user_id,
        email: session.email,
        globalRole: session.global_role,
      });
      verified = true;
    } catch {
      const attempts = session.mfa_failed_attempts + 1;
      if (attempts >= 10) {
        await client.query("UPDATE auth_sessions SET revoked_at = now() WHERE id = $1", [session.id]);
        await client.query(
          "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'mfa_challenge_destroyed')",
          [session.user_id],
        );
      } else {
        await client.query(
          "UPDATE auth_sessions SET mfa_failed_attempts = $2 WHERE id = $1",
          [session.id, attempts],
        );
      }
      await client.query(
        "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'mfa_failed')",
        [session.user_id],
      );
      await client.query("COMMIT");
      throw new MfaChallengeError("INVALID_CODE");
    }
    if (!verified) throw new MfaChallengeError("INVALID_CODE");

    const rotated = generateOpaqueToken();
    const refreshedAt = new Date(now);
    const expiresAt = new Date(Math.min(
      session.created_at.getTime() + policy.absoluteSeconds * 1000,
      now + policy.inactivitySeconds * 1000,
    ));
    await client.query(
      `UPDATE auth_sessions
          SET auth_level = 'full', token_hash = $2, mfa_verified_at = $3,
              last_seen_at = $3, rotated_at = $3, expires_at = $4, mfa_failed_attempts = 0
        WHERE id = $1`,
      [session.id, rotated.tokenHash, refreshedAt, expiresAt],
    );
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'login_mfa_complete')",
      [session.user_id],
    );
    await client.query("COMMIT");
    return {
      token: rotated.token,
      user: {
        id: session.user_id,
        email: session.email,
        globalRole: session.global_role,
        emailVerified: Boolean(session.email_verified_at),
        authLevel: "full",
        mfaVerifiedAt: refreshedAt,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export class MfaChallengeError extends Error {
  constructor(readonly code: string) {
    super(`MFA challenge failed: ${code}`);
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
      `SELECT s.id, s.user_id, s.auth_level, s.created_at, s.last_seen_at, s.rotated_at, s.expires_at, s.revoked_at, s.mfa_verified_at,
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

    const authLevel: AuthLevel = session.auth_level === "full"
      ? "full"
      : session.auth_level === "mfa"
        ? "mfa"
        : "password";

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
      user: toSessionUser(session, authLevel),
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

export function sessionHasRecentMfa(user: SessionUser): boolean {
  if (user.authLevel !== "full") return false;
  if (!user.mfaVerifiedAt) return false;
  const now = Date.now();
  return now - user.mfaVerifiedAt.getTime() < config.adminMfaReauthSeconds * 1000;
}
