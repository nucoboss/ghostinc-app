import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { beforeEach, describe, it } from "node:test";
import { truncateAll } from "./helpers/db.js";
import "./helpers/setup.js";

const { db } = await import("../src/db.js");
const { setUserBlocked, setUserPassword, setUserRole } = await import("../src/services/auth-store.js");

async function seedUserWithSession(email: string, role: "user" | "admin" = "user") {
  const user = await db.query<{ id: string }>(
    "INSERT INTO users (email, global_role) VALUES ($1, $2) RETURNING id",
    [email, role],
  );
  await db.query(
    "INSERT INTO auth_sessions (user_id, token_hash, auth_level, expires_at) VALUES ($1, $2, 'full', now() + interval '1 hour')",
    [user.rows[0]!.id, randomBytes(32)],
  );
  return user.rows[0]!.id;
}

describe("local identity schema", () => {
  beforeEach(async () => truncateAll());

  it("crea usuarios comunes por defecto y acepta un admin explícito", async () => {
    const user = await db.query<{ global_role: string }>(
      "INSERT INTO users (email) VALUES ('user@example.com') RETURNING global_role",
    );
    const admin = await db.query<{ global_role: string }>(
      "INSERT INTO users (email, global_role) VALUES ('admin@example.com', 'admin') RETURNING global_role",
    );
    assert.equal(user.rows[0]!.global_role, "user");
    assert.equal(admin.rows[0]!.global_role, "admin");
  });

  it("rechaza emails duplicados sin distinguir mayúsculas", async () => {
    await db.query("INSERT INTO users (email) VALUES ('user@example.com')");
    await assert.rejects(
      db.query("INSERT INTO users (email) VALUES ('User@Example.com')"),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23505",
    );
  });

  it("restringe roles y hashes de tokens", async () => {
    await assert.rejects(
      db.query("INSERT INTO users (email, global_role) VALUES ('owner@example.com', 'owner')"),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23514",
    );
    const user = await db.query<{ id: string }>(
      "INSERT INTO users (email) VALUES ('user@example.com') RETURNING id",
    );
    await assert.rejects(
      db.query(
        "INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at) VALUES ($1, 'registration', $2, now() + interval '30 minutes')",
        [user.rows[0]!.id, randomBytes(16)],
      ),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "23514",
    );
  });

  it("elimina credenciales y sesiones al eliminar un usuario", async () => {
    const user = await db.query<{ id: string }>(
      "INSERT INTO users (email) VALUES ('user@example.com') RETURNING id",
    );
    await db.query(
      "INSERT INTO auth_sessions (user_id, token_hash, auth_level, expires_at) VALUES ($1, $2, 'full', now() + interval '1 hour')",
      [user.rows[0]!.id, randomBytes(32)],
    );
    await db.query("DELETE FROM users WHERE id = $1", [user.rows[0]!.id]);
    const sessions = await db.query("SELECT 1 FROM auth_sessions");
    assert.equal(sessions.rowCount, 0);
  });

  it("cambiar contraseña verifica email y revoca sesiones", async () => {
    const userId = await seedUserWithSession("password@example.com");
    const passwordHash = await setUserPassword(userId, "correct horse battery staple");
    const user = await db.query<{ password_hash: string; email_verified_at: Date }>(
      "SELECT password_hash, email_verified_at FROM users WHERE id = $1",
      [userId],
    );
    const sessions = await db.query<{ revoked_at: Date | null }>(
      "SELECT revoked_at FROM auth_sessions WHERE user_id = $1",
      [userId],
    );
    assert.equal(user.rows[0]!.password_hash, passwordHash);
    assert.ok(user.rows[0]!.email_verified_at);
    assert.ok(sessions.rows[0]!.revoked_at);
  });

  it("bloquear un usuario revoca sesiones y registra auditoría", async () => {
    const actorId = await seedUserWithSession("actor@example.com", "admin");
    const userId = await seedUserWithSession("blocked@example.com");
    await setUserBlocked(userId, true, actorId);
    const user = await db.query<{ blocked_at: Date | null }>("SELECT blocked_at FROM users WHERE id = $1", [userId]);
    const activeSessions = await db.query(
      "SELECT 1 FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    const events = await db.query<{ event_type: string }>(
      "SELECT event_type FROM auth_events WHERE user_id = $1",
      [userId],
    );
    assert.ok(user.rows[0]!.blocked_at);
    assert.equal(activeSessions.rowCount, 0);
    assert.deepEqual(events.rows.map(({ event_type }) => event_type), ["user_blocked"]);
  });

  it("cambiar rol revoca sesiones y registra auditoría", async () => {
    const actorId = await seedUserWithSession("actor@example.com", "admin");
    const userId = await seedUserWithSession("promoted@example.com");
    await setUserRole(userId, "admin", actorId);
    const user = await db.query<{ global_role: string }>("SELECT global_role FROM users WHERE id = $1", [userId]);
    const activeSessions = await db.query(
      "SELECT 1 FROM auth_sessions WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    const events = await db.query<{ event_type: string }>(
      "SELECT event_type FROM auth_events WHERE user_id = $1",
      [userId],
    );
    assert.equal(user.rows[0]!.global_role, "admin");
    assert.equal(activeSessions.rowCount, 0);
    assert.deepEqual(events.rows.map(({ event_type }) => event_type), ["role_changed"]);
  });
});
