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
) {
  await client.query(
    "INSERT INTO auth_events (user_id, actor_user_id, event_type) VALUES ($1, $2, $3)",
    [userId, actorUserId ?? null, eventType],
  );
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
    const result = await client.query(
      "UPDATE users SET blocked_at = CASE WHEN $2 THEN now() ELSE NULL END WHERE id = $1",
      [userId, blocked],
    );
    if (!result.rowCount) throw new Error("USER_NOT_FOUND");
    if (blocked) await revokeSessions(client, userId);
    await recordAuthEvent(client, blocked ? "user_blocked" : "user_unblocked", userId, actorUserId);
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
    const result = await client.query(
      "UPDATE users SET global_role = $2 WHERE id = $1",
      [userId, role],
    );
    if (!result.rowCount) throw new Error("USER_NOT_FOUND");
    await revokeSessions(client, userId);
    await recordAuthEvent(client, "role_changed", userId, actorUserId);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
