import type { PoolClient } from "pg";
import { db } from "../db.js";
import { hashPassword } from "./auth-crypto.js";

export type GlobalRole = "user" | "admin";

async function revokeSessions(client: PoolClient, userId: string) {
  await client.query(
    "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId],
  );
}

async function recordAuthEvent(
  client: PoolClient,
  eventType: string,
  userId: string,
  actorUserId?: string,
  metadata: Record<string, unknown> = {},
) {
  await client.query(
    "INSERT INTO auth_events (user_id, actor_user_id, event_type, metadata) VALUES ($1, $2, $3, $4)",
    [userId, actorUserId ?? null, eventType, JSON.stringify(metadata)],
  );
}

async function lockAdminMutation(client: PoolClient, actorUserId: string) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('ghostinc-admin-mutation'))");
  const actor = await client.query<{ global_role: GlobalRole; blocked_at: Date | null }>(
    "SELECT global_role, blocked_at FROM users WHERE id = $1 FOR UPDATE",
    [actorUserId],
  );
  if (actor.rows[0]?.global_role !== "admin" || actor.rows[0].blocked_at) {
    throw new Error("ADMIN_ACTOR_INVALID");
  }
}

export async function setUserPassword(userId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE users
       SET password_hash = $2,
           password_changed_at = now(),
           email_verified_at = COALESCE(email_verified_at, now())
       WHERE id = $1`,
      [userId, passwordHash],
    );
    if (!result.rowCount) throw new Error("USER_NOT_FOUND");
    await revokeSessions(client, userId);
    await recordAuthEvent(client, "password_changed", userId, userId);
    await client.query("COMMIT");
    return passwordHash;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setUserBlocked(userId: string, blocked: boolean, actorUserId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await lockAdminMutation(client, actorUserId);
    if (userId === actorUserId) throw new Error("INVALID_SELF_ACTION");
    const target = await client.query<{ global_role: GlobalRole; blocked_at: Date | null }>(
      "SELECT global_role, blocked_at FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    if (!target.rowCount) throw new Error("USER_NOT_FOUND");
    if (blocked && target.rows[0]!.global_role === "admin" && !target.rows[0]!.blocked_at) {
      const remaining = await client.query<{ count: string }>(
        "SELECT count(*) FROM users WHERE global_role = 'admin' AND blocked_at IS NULL AND id <> $1",
        [userId],
      );
      if (Number(remaining.rows[0]!.count) === 0) throw new Error("LAST_ACTIVE_ADMIN");
    }
    await client.query(
      "UPDATE users SET blocked_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1",
      [userId, blocked],
    );
    if (blocked) await revokeSessions(client, userId);
    await recordAuthEvent(
      client,
      blocked ? "user_blocked" : "user_unblocked",
      userId,
      actorUserId,
      { previously_blocked: Boolean(target.rows[0]!.blocked_at), blocked },
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function setUserRole(userId: string, role: GlobalRole, actorUserId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await lockAdminMutation(client, actorUserId);
    if (userId === actorUserId) throw new Error("INVALID_SELF_ACTION");
    const target = await client.query<{ global_role: GlobalRole }>(
      "SELECT global_role FROM users WHERE id = $1 FOR UPDATE",
      [userId],
    );
    if (!target.rowCount) throw new Error("USER_NOT_FOUND");
    if (target.rows[0]!.global_role === "admin" && role === "user") {
      const remaining = await client.query<{ count: string }>(
        "SELECT count(*) FROM users WHERE global_role = 'admin' AND blocked_at IS NULL AND id <> $1",
        [userId],
      );
      if (Number(remaining.rows[0]!.count) === 0) throw new Error("LAST_ACTIVE_ADMIN");
    }
    await client.query("UPDATE users SET global_role = $2 WHERE id = $1", [userId, role]);
    await revokeSessions(client, userId);
    await recordAuthEvent(client, "role_changed", userId, actorUserId, {
      previous_role: target.rows[0]!.global_role,
      role,
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
