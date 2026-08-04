import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOTP } from "otpauth";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";
import { truncateAll } from "./helpers/db.js";

const { buildApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { hashPassword } = await import("../src/services/auth-crypto.js");
const { checkSession, loginUser, verifyMfaChallenge } = await import("../src/services/auth-sessions.js");
const { emailOutbox } = await import("../src/services/email.js");
const { setUserRole } = await import("../src/services/auth-store.js");
const {
  confirmTotpEnrollment,
  enrollTotp,
  verifyTotpChallenge,
} = await import("../src/services/auth-mfa.js");
const app = await buildApp();
let adminSessionToken = "";
let adminUserId = "";

/** Retorna la sesión admin completa tras enrolar y superar el desafío MFA. */
async function obtainAdminFullSession() {
  const login = await loginUser("admin@example.com", "correct horse battery staple");
  if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required al loguear admin");
  const enrollment = await enrollTotp(login.user.id, login.user.email);
  const totp = new TOTP({ algorithm: "SHA1", digits: 6, period: 30, secret: enrollment.secretBase32 });
  await confirmTotpEnrollment(login.user.id, totp.generate(), login.token);
  const step = Math.floor(Date.now() / 1000 / 30);
  const nextCode = totp.generate({ timestamp: (step + 1) * 30 * 1000 });
  const completed = await verifyMfaChallenge(login.token, async (session) => {
    await verifyTotpChallenge(session.userId, nextCode);
  });
  return completed.token;
}

before(async () => {
  await truncateAll();
  const passwordHash = await hashPassword("correct horse battery staple");
  await db.query(
    "INSERT INTO users (email, password_hash, global_role) VALUES ('admin@example.com', $1, 'admin')",
    [passwordHash],
  );
  adminSessionToken = await obtainAdminFullSession();
  adminUserId = (await db.query<{ id: string }>(
    "SELECT id FROM users WHERE email = 'admin@example.com'",
  )).rows[0]!.id;
});

after(async () => {
  await app.close();
});

describe("GET /internal/admin/overview", () => {
  it("responde 401 sin token interno", async () => {
    const response = await app.inject({ method: "GET", url: "/internal/admin/overview" });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "unauthorized");
  });

  it("responde 401 con token incorrecto", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/internal/admin/overview",
      headers: { "x-internal-token": "token-incorrecto-con-suficiente-longitud" },
    });
    assert.equal(response.statusCode, 401);
  });

  it("responde 403 sin sesión administrativa", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/internal/admin/overview",
      headers: { "x-internal-token": TEST_INTERNAL_TOKEN },
    });
    assert.equal(response.statusCode, 403);
  });

  it("responde 200 con token interno y sesión administrativa", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/internal/admin/overview",
      headers: {
        "x-internal-token": TEST_INTERNAL_TOKEN,
        "x-session-token": adminSessionToken,
      },
    });
    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.ok(body.data.metrics.users === 1);
    assert.ok(Array.isArray(body.data.activity));
    assert.ok(Array.isArray(body.data.accounts));
  });
});

function adminHeaders() {
  return {
    "x-internal-token": TEST_INTERNAL_TOKEN,
    "x-session-token": adminSessionToken,
  };
}

async function seedUser(email: string) {
  const passwordHash = await hashPassword("correct horse battery staple");
  const result = await db.query<{ id: string }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
    [email, passwordHash],
  );
  return result.rows[0]!.id;
}

describe("administración local de usuarios", () => {
  it("lista identidades locales con una sesión admin y MFA reciente", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/internal/admin/users",
      headers: adminHeaders(),
    });
    assert.equal(response.statusCode, 200);
    assert.ok(response.json<{ data: { users: Array<{ email: string }> } }>().data.users.some(
      (user) => user.email === "admin@example.com",
    ));
  });

  it("invita una cuenta común y audita al administrador", async () => {
    emailOutbox.length = 0;
    const response = await app.inject({
      method: "POST",
      url: "/internal/admin/users/invite",
      headers: adminHeaders(),
      payload: { token: adminSessionToken, email: "invited@example.com" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(emailOutbox.length, 1);
    assert.equal(emailOutbox[0]!.to, "invited@example.com");
    assert.match(emailOutbox[0]!.html, /#token=.*mode=registration/);

    const invited = await db.query<{ id: string; global_role: string; password_hash: string | null }>(
      "SELECT id, global_role, password_hash FROM users WHERE email = 'invited@example.com'",
    );
    assert.equal(invited.rows[0]!.global_role, "user");
    assert.equal(invited.rows[0]!.password_hash, null);
    const event = await db.query<{ actor_user_id: string }>(
      "SELECT actor_user_id FROM auth_events WHERE user_id = $1 AND event_type = 'admin_invitation_created'",
      [invited.rows[0]!.id],
    );
    assert.equal(event.rows[0]!.actor_user_id, adminUserId);
  });

  it("bloquea, revoca sesiones y desbloquea una cuenta con auditoría", async () => {
    const userId = await seedUser("blocked@example.com");
    const login = await loginUser("blocked@example.com", "correct horse battery staple");
    if (login.kind !== "authenticated") throw new Error("Se esperaba login completo");

    const blocked = await app.inject({
      method: "POST",
      url: `/internal/admin/users/${userId}/block`,
      headers: adminHeaders(),
      payload: { token: adminSessionToken },
    });
    assert.equal(blocked.statusCode, 200);
    assert.equal((await checkSession(login.token)).kind, "invalid");

    const unblocked = await app.inject({
      method: "POST",
      url: `/internal/admin/users/${userId}/unblock`,
      headers: adminHeaders(),
      payload: { token: adminSessionToken },
    });
    assert.equal(unblocked.statusCode, 200);
    const events = await db.query<{ event_type: string; actor_user_id: string }>(
      "SELECT event_type, actor_user_id FROM auth_events WHERE user_id = $1 AND event_type IN ('user_blocked', 'user_unblocked') ORDER BY id",
      [userId],
    );
    assert.deepEqual(events.rows.map((row) => row.event_type), ["user_blocked", "user_unblocked"]);
    assert.ok(events.rows.every((row) => row.actor_user_id === adminUserId));
  });

  it("cambia roles, revoca sesiones y registra el actor", async () => {
    const userId = await seedUser("role@example.com");
    const login = await loginUser("role@example.com", "correct horse battery staple");
    if (login.kind !== "authenticated") throw new Error("Se esperaba login completo");
    const response = await app.inject({
      method: "POST",
      url: `/internal/admin/users/${userId}/role`,
      headers: adminHeaders(),
      payload: { token: adminSessionToken, role: "admin" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal((await checkSession(login.token)).kind, "invalid");
    const changed = await db.query<{ global_role: string }>("SELECT global_role FROM users WHERE id = $1", [userId]);
    assert.equal(changed.rows[0]!.global_role, "admin");
    const event = await db.query<{ metadata: { previous_role: string; role: string } }>(
      "SELECT metadata FROM auth_events WHERE user_id = $1 AND event_type = 'role_changed'",
      [userId],
    );
    assert.deepEqual(event.rows[0]!.metadata, { previous_role: "user", role: "admin" });
  });

  it("serializa cambios concurrentes y revalida al actor", async () => {
    const first = await db.query<{ id: string }>(
      "INSERT INTO users (email, global_role) VALUES ('first-admin@example.com', 'admin') RETURNING id",
    );
    const second = await db.query<{ id: string }>(
      "INSERT INTO users (email, global_role) VALUES ('second-admin@example.com', 'admin') RETURNING id",
    );
    const results = await Promise.allSettled([
      setUserRole(second.rows[0]!.id, "user", first.rows[0]!.id),
      setUserRole(first.rows[0]!.id, "user", second.rows[0]!.id),
    ]);
    assert.deepEqual(results.map((result) => result.status).sort(), ["fulfilled", "rejected"]);
    const active = await db.query<{ count: string }>(
      "SELECT count(*) FROM users WHERE id IN ($1, $2) AND global_role = 'admin' AND blocked_at IS NULL",
      [first.rows[0]!.id, second.rows[0]!.id],
    );
    assert.equal(Number(active.rows[0]!.count), 1);
  });

  it("impide que un admin se bloquee o cambie su propio rol", async () => {
    const block = await app.inject({
      method: "POST",
      url: `/internal/admin/users/${adminUserId}/block`,
      headers: adminHeaders(),
      payload: { token: adminSessionToken },
    });
    const role = await app.inject({
      method: "POST",
      url: `/internal/admin/users/${adminUserId}/role`,
      headers: adminHeaders(),
      payload: { token: adminSessionToken, role: "user" },
    });
    assert.equal(block.statusCode, 400);
    assert.equal(role.statusCode, 400);
  });

  it("rechaza mutaciones desde una sesión no administrativa", async () => {
    await seedUser("not-admin@example.com");
    const login = await loginUser("not-admin@example.com", "correct horse battery staple");
    if (login.kind !== "authenticated") throw new Error("Se esperaba login completo");
    const response = await app.inject({
      method: "POST",
      url: "/internal/admin/users/invite",
      headers: {
        "x-internal-token": TEST_INTERNAL_TOKEN,
        "x-session-token": login.token,
      },
      payload: { token: login.token, email: "forbidden@example.com" },
    });
    assert.equal(response.statusCode, 403);
  });

  it("rechaza administración cuando la verificación MFA dejó de ser reciente", async () => {
    await db.query(
      "UPDATE auth_sessions SET mfa_verified_at = now() - interval '1 hour' WHERE user_id = $1 AND revoked_at IS NULL",
      [adminUserId],
    );
    const response = await app.inject({
      method: "GET",
      url: "/internal/admin/users",
      headers: adminHeaders(),
    });
    assert.equal(response.statusCode, 403);
    await db.query(
      "UPDATE auth_sessions SET mfa_verified_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [adminUserId],
    );
  });
});
