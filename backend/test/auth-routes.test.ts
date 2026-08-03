import "./helpers/setup.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";

const { db } = await import("../src/db.js");
const { buildApp } = await import("../src/app.js");
const { truncateAll } = await import("./helpers/db.js");
const { hashPassword } = await import("../src/services/auth-crypto.js");
const {
  checkSession,
  loginUser,
  revokeSession,
} = await import("../src/services/auth-sessions.js");

const app = await buildApp();

const TEST_PASSWORD = "correct horse battery staple";
const POLICY = {
  absoluteSeconds: 3_600,
  inactivitySeconds: 1_800,
  rotationSeconds: 60,
};

async function seedUser(email: string, options: { blocked?: boolean; password?: boolean } = {}) {
  const passwordHash = options.password ? await hashPassword(TEST_PASSWORD) : null;
  const result = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, blocked_at)
     VALUES ($1, $2, ${options.blocked ? "now()" : "NULL"})
     RETURNING id`,
    [email, passwordHash],
  );
  return result.rows[0]!.id;
}

function sessionRow(token: string) {
  return db.query(
    "SELECT * FROM auth_sessions WHERE token_hash = sha256(convert_to($1, 'UTF8'))",
    [token],
  );
}

beforeEach(async () => {
  await truncateAll();
});

after(async () => {
  await app.close();
});

describe("loginUser", () => {
  it("crea una sesión cuyo hash no expone el token y actualiza last_login", async () => {
    await seedUser("alice@example.com", { password: true });
    const { token, user } = await loginUser("Alice@Example.com", TEST_PASSWORD, POLICY);

    assert.equal(user.email, "alice@example.com");
    assert.equal(user.globalRole, "user");
    assert.equal(token.length, 43);

    const rows = await sessionRow(token);
    assert.equal(rows.rowCount, 1);
    assert.notEqual(Buffer.from(rows.rows[0]!.token_hash).toString("hex"), token);
    const stored = await db.query<{ last_login_at: Date | null }>(
      "SELECT last_login_at FROM users WHERE email = $1",
      ["alice@example.com"],
    );
    assert.ok(stored.rows[0]!.last_login_at);
  });

  it("rechaza email desconocido y contraseña errónea con el mismo error", async () => {
    await seedUser("bob@example.com", { password: true });
    const unknown = await loginUser("nobody@example.com", TEST_PASSWORD, POLICY)
      .catch((error: unknown) => error);
    const wrong = await loginUser("bob@example.com", "wrong password here", POLICY)
      .catch((error: unknown) => error);
    assert.ok(unknown instanceof Error && wrong instanceof Error);
    assert.equal(unknown.message, wrong.message);
  });

  it("no crea sesión para usuarios sin contraseña ni bloqueados", async () => {
    await seedUser("unset@example.com");
    await seedUser("blocked@example.com", { password: true, blocked: true });

    await assert.rejects(
      loginUser("unset@example.com", TEST_PASSWORD, POLICY),
      /Credenciales inválidas/,
    );
    await assert.rejects(
      loginUser("blocked@example.com", TEST_PASSWORD, POLICY),
      /Credenciales inválidas/,
    );
    const sessions = await db.query("SELECT 1 FROM auth_sessions");
    assert.equal(sessions.rowCount, 0);
  });

  it("emite tokens distintos en cada login (anti-fijación)", async () => {
    await seedUser("fixation@example.com", { password: true });
    const first = await loginUser("fixation@example.com", TEST_PASSWORD, POLICY);
    const second = await loginUser("fixation@example.com", TEST_PASSWORD, POLICY);
    assert.notEqual(first.token, second.token);
  });

  it("registra eventos login y login_failed", async () => {
    await seedUser("events@example.com", { password: true });
    await loginUser("events@example.com", TEST_PASSWORD, POLICY);
    await loginUser("events@example.com", "bad password here", POLICY).catch(() => {});
    const events = await db.query<{ event_type: string }>(
      "SELECT event_type FROM auth_events ORDER BY id",
    );
    assert.deepEqual(events.rows.map((row) => row.event_type), ["login", "login_failed"]);
  });
});

describe("checkSession", () => {
  it("valida una sesión activa y devuelve el usuario", async () => {
    await seedUser("session@example.com", { password: true });
    const { token, user } = await loginUser("session@example.com", TEST_PASSWORD, POLICY);
    const result = await checkSession(token, POLICY);
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") {
      assert.equal(result.user.id, user.id);
      assert.equal(result.token, undefined);
    }
  });

  it("rechaza tokens desconocidos y sesiones revocadas", async () => {
    const unknown = await checkSession("not-a-real-token", POLICY);
    assert.equal(unknown.kind, "invalid");

    await seedUser("revoked@example.com", { password: true });
    const { token } = await loginUser("revoked@example.com", TEST_PASSWORD, POLICY);
    await revokeSession(token);
    const result = await checkSession(token, POLICY);
    assert.equal(result.kind, "invalid");
  });

  it("revoca sesiones vencidas por inactividad", async () => {
    await seedUser("idle@example.com", { password: true });
    const { token } = await loginUser("idle@example.com", TEST_PASSWORD, POLICY);
    await db.query(
      "UPDATE auth_sessions SET last_seen_at = now() - interval '2 hours'",
    );
    const result = await checkSession(token, POLICY);
    assert.equal(result.kind, "expired");
    const row = await sessionRow(token);
    assert.ok(row.rows[0]!.revoked_at);
  });

  it("revoca sesiones que superan el límite absoluto", async () => {
    await seedUser("old@example.com", { password: true });
    const { token } = await loginUser("old@example.com", TEST_PASSWORD, POLICY);
    await db.query("UPDATE auth_sessions SET created_at = now() - interval '2 hours'");
    const result = await checkSession(token, POLICY);
    assert.equal(result.kind, "expired");
  });

  it("rota el token y el anterior queda inválido", async () => {
    await seedUser("rotate@example.com", { password: true });
    const { token } = await loginUser("rotate@example.com", TEST_PASSWORD, POLICY);
    await db.query("UPDATE auth_sessions SET rotated_at = now() - interval '2 minutes'");

    const rotated = await checkSession(token, POLICY, true);
    assert.equal(rotated.kind, "ok");
    if (rotated.kind === "ok") {
      assert.ok(rotated.token);
      assert.notEqual(rotated.token, token);
      const old = await checkSession(token, POLICY, true);
      assert.equal(old.kind, "invalid");
      const fresh = await checkSession(rotated.token!, POLICY, true);
      assert.equal(fresh.kind, "ok");
    }
  });

  it("no rota cuando no se cumple la ventana", async () => {
    await seedUser("fresh@example.com", { password: true });
    const { token } = await loginUser("fresh@example.com", TEST_PASSWORD, POLICY);
    const result = await checkSession(token, POLICY, true);
    assert.equal(result.kind, "ok");
    if (result.kind === "ok") assert.equal(result.token, undefined);
  });

  it("revoca la sesión de un usuario bloqueado", async () => {
    const userId = await seedUser("later-blocked@example.com", { password: true });
    const { token } = await loginUser("later-blocked@example.com", TEST_PASSWORD, POLICY);
    await db.query("UPDATE users SET blocked_at = now() WHERE id = $1", [userId]);
    const result = await checkSession(token, POLICY);
    assert.equal(result.kind, "blocked");
    const row = await sessionRow(token);
    assert.ok(row.rows[0]!.revoked_at);
  });
});

describe("POST /internal/auth/*", () => {
  const headers = { "x-internal-token": TEST_INTERNAL_TOKEN, "x-client-ip": "203.0.113.77" };

  it("exige el token interno", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      payload: { email: "route@example.com", password: TEST_PASSWORD },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "unauthorized");
  });

  it("login devuelve token y usuario, y logout la revoca", async () => {
    await seedUser("route@example.com", { password: true });
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers,
      payload: { email: "route@example.com", password: TEST_PASSWORD },
    });
    assert.equal(login.statusCode, 200);
    const body = login.json() as { token: string; user: { email: string } };
    assert.equal(body.user.email, "route@example.com");

    const session = await app.inject({
      method: "POST",
      url: "/internal/auth/session",
      headers,
      payload: { token: body.token },
    });
    assert.equal(session.statusCode, 200);

    const logout = await app.inject({
      method: "POST",
      url: "/internal/auth/logout",
      headers,
      payload: { token: body.token },
    });
    assert.equal(logout.statusCode, 200);
    assert.equal(logout.json().ok, true);

    const after = await app.inject({
      method: "POST",
      url: "/internal/auth/session",
      headers,
      payload: { token: body.token },
    });
    assert.equal(after.statusCode, 401);
  });

  it("logout es idempotente", async () => {
    const token = "some-unknown-token-value";
    for (let i = 0; i < 2; i += 1) {
      const logout = await app.inject({
        method: "POST",
        url: "/internal/auth/logout",
        headers,
        payload: { token },
      });
      assert.equal(logout.statusCode, 200);
    }
  });

  it("credenciales inválidas responden 401 genérico en ruta", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers,
      payload: { email: "unknown@example.com", password: "whatever-123456" },
    });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "invalid_credentials");
  });

  it("aplica rate limit al login por cliente", async () => {
    await seedUser("limited@example.com", { password: true });
    let lastStatus = 0;
    for (let i = 0; i < 11; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/internal/auth/login",
        headers: { ...headers, "x-client-ip": "198.51.100.9" },
        payload: { email: "limited@example.com", password: TEST_PASSWORD },
      });
      lastStatus = response.statusCode;
    }
    assert.equal(lastStatus, 429);
  });

  it("rechaza cuerpos con campos extra", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers,
      payload: { email: "a@example.com", password: "x", extra: true },
    });
    assert.equal(response.statusCode, 400);
  });

  it("la rotación por ruta devuelve un token renovado", async () => {
    await seedUser("route-rotate@example.com", { password: true });
    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers,
      payload: { email: "route-rotate@example.com", password: TEST_PASSWORD },
    });
    const token = (login.json() as { token: string }).token;
    await db.query("UPDATE auth_sessions SET rotated_at = now() - interval '16 minutes'");

    const rotated = await app.inject({
      method: "POST",
      url: "/internal/auth/session/rotate",
      headers,
      payload: { token },
    });
    assert.equal(rotated.statusCode, 200);
    const rotatedBody = rotated.json() as { token?: string };
    assert.ok(rotatedBody.token);
    assert.notEqual(rotatedBody.token, token);
  });
});
