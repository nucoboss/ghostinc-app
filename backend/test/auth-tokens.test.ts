import "./helpers/setup.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";

const { db } = await import("../src/db.js");
const { buildApp } = await import("../src/app.js");
const { truncateAll } = await import("./helpers/db.js");
const { hashPassword } = await import("../src/services/auth-crypto.js");
const { emailOutbox } = await import("../src/services/email.js");
const { issueAuthToken, consumeAuthToken } = await import("../src/services/auth-tokens.js");

const app = await buildApp();
const headers = { "x-internal-token": TEST_INTERNAL_TOKEN, "x-client-ip": "198.51.100.20" };
const GOOD_PASSWORD = "correct horse battery staple";

function ip(email: string) {
  return { ...headers, "x-client-ip": `198.51.100.${email.length % 250 + 1}` };
}

async function seedPasswordUser(email: string) {
  const passwordHash = await hashPassword(GOOD_PASSWORD);
  const result = await db.query<{ id: string }>(
    "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
    [email, passwordHash],
  );
  return result.rows[0]!.id;
}

function extractLink(message: { html: string }) {
  const match = message.html.match(/href="([^"]+)"/);
  assert.ok(match, "el correo debe contener un enlace");
  return match[1]!;
}

function tokenFromLink(link: string) {
  return new URLSearchParams(new URL(link).hash.slice(1)).get("token")!;
}

beforeEach(async () => {
  await truncateAll();
  emailOutbox.length = 0;
});

after(async () => {
  await app.close();
});

describe("registro", () => {
  it("crea usuario y token, y envía un enlace de uso único", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/register",
      headers: ip("new@example.com"),
      payload: { email: "new@example.com" },
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().ok, true);

    const tokens = await db.query("SELECT purpose, used_at FROM auth_tokens");
    assert.equal(tokens.rowCount, 1);
    assert.equal(tokens.rows[0]!.purpose, "registration");
    assert.equal(tokens.rows[0]!.used_at, null);

    assert.equal(emailOutbox.length, 1);
    assert.equal(emailOutbox[0]!.to, "new@example.com");
    const link = extractLink(emailOutbox[0]!);
    assert.match(link, /\/crear-contrasena#token=/);
    assert.equal(new URL(link).search, "");
  });

  it("no enumera: respuesta idéntica para correos existentes con contraseña", async () => {
    await seedPasswordUser("existing@example.com");

    const unknown = await app.inject({
      method: "POST",
      url: "/internal/auth/register",
      headers: ip("unknown@example.com"),
      payload: { email: "unknown@example.com" },
    });
    const existing = await app.inject({
      method: "POST",
      url: "/internal/auth/register",
      headers: ip("existing@example.com"),
      payload: { email: "existing@example.com" },
    });

    assert.equal(unknown.statusCode, existing.statusCode);
    assert.deepEqual(unknown.json(), existing.json());
    assert.equal(emailOutbox.length, 1);
  });

  it("reemplaza tokens de registro previos y aplica rate limit", async () => {
    await app.inject({ method: "POST", url: "/internal/auth/register", headers: ip("multi@example.com"), payload: { email: "multi@example.com" } });
    await app.inject({ method: "POST", url: "/internal/auth/register", headers: ip("multi@example.com"), payload: { email: "multi@example.com" } });

    const active = await db.query("SELECT 1 FROM auth_tokens WHERE used_at IS NULL");
    assert.equal(active.rowCount, 1);

    let lastStatus = 0;
    for (let i = 0; i < 4; i += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/internal/auth/register",
        headers: { ...headers, "x-client-ip": "203.0.113.55" },
        payload: { email: `rate-${i}@example.com` },
      });
      lastStatus = response.statusCode;
    }
    assert.equal(lastStatus, 429);
  });
});

describe("recuperación", () => {
  it("envía enlace solo a usuarios con contraseña y no enumera", async () => {
    await seedPasswordUser("lost@example.com");

    const withPassword = await app.inject({
      method: "POST",
      url: "/internal/auth/recovery",
      headers: ip("lost@example.com"),
      payload: { email: "lost@example.com" },
    });
    const withoutPassword = await app.inject({
      method: "POST",
      url: "/internal/auth/recovery",
      headers: ip("nopassword@example.com"),
      payload: { email: "nopassword@example.com" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/internal/auth/recovery",
      headers: ip("ghost@example.com"),
      payload: { email: "ghost@example.com" },
    });

    assert.equal(withPassword.statusCode, 200);
    assert.deepEqual(withoutPassword.json(), unknown.json());
    assert.equal(emailOutbox.length, 1);
    const token = await db.query<{ purpose: string }>("SELECT purpose FROM auth_tokens");
    assert.equal(token.rows[0]!.purpose, "password_reset");
  });
});

describe("set-password", () => {
  it("consuma el enlace, verifica el correo y revoca sesiones", async () => {
    await seedPasswordUser("change@example.com");
    await app.inject({
      method: "POST",
      url: "/internal/auth/recovery",
      headers: ip("change@example.com"),
      payload: { email: "change@example.com" },
    });
    const token = tokenFromLink(extractLink(emailOutbox[0]!));
    await db.query(
      "INSERT INTO auth_sessions (user_id, token_hash, auth_level, expires_at) VALUES ((SELECT id FROM users WHERE email = $1), decode(repeat('00', 32), 'hex'), 'full', now() + interval '1 hour')",
      ["change@example.com"],
    );

    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/set-password",
      headers,
      payload: { token, password: "new-password-2026" },
    });
    assert.equal(response.statusCode, 200);

    const user = await db.query<{ password_hash: string; email_verified_at: Date | null }>(
      "SELECT password_hash, email_verified_at FROM users WHERE email = $1",
      ["change@example.com"],
    );
    assert.notEqual(user.rows[0]!.password_hash, null);
    assert.ok(user.rows[0]!.email_verified_at);
    const active = await db.query("SELECT 1 FROM auth_sessions WHERE revoked_at IS NULL");
    assert.equal(active.rowCount, 0);
  });

  it("rechaza un enlace ya usado y uno vencido", async () => {
    await seedPasswordUser("replay@example.com");
    const issued = await issueAuthToken("replay@example.com", "password_reset");
    assert.ok(issued);
    await consumeAuthToken(issued.token, "new-password-2026");

    const replay = await app.inject({
      method: "POST",
      url: "/internal/auth/set-password",
      headers: ip("replay@example.com"),
      payload: { token: issued.token, password: "another-password" },
    });
    assert.equal(replay.statusCode, 400);
    assert.equal(replay.json().error, "invalid_token");

    const second = await issueAuthToken("replay@example.com", "password_reset");
    assert.ok(second);
    await db.query("UPDATE auth_tokens SET expires_at = now() - interval '1 minute', created_at = now() - interval '2 minutes' WHERE user_id = (SELECT id FROM users WHERE email = $1)", ["replay@example.com"]);
    const expired = await app.inject({
      method: "POST",
      url: "/internal/auth/set-password",
      headers: ip("replay-expired@example.com"),
      payload: { token: second.token, password: "another-password" },
    });
    assert.equal(expired.statusCode, 400);
    assert.equal(expired.json().error, "invalid_token");
  });

  it("solo una operación puede consumir el mismo enlace concurrentemente", async () => {
    await seedPasswordUser("concurrent@example.com");
    const issued = await issueAuthToken("concurrent@example.com", "password_reset");
    assert.ok(issued);

    const results = await Promise.allSettled([
      consumeAuthToken(issued.token, "first-password-2026"),
      consumeAuthToken(issued.token, "second-password-2026"),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);

    const token = await db.query<{ used_at: Date | null }>("SELECT used_at FROM auth_tokens");
    assert.ok(token.rows[0]!.used_at);
    const events = await db.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM auth_events WHERE event_type = 'token_consumed'",
    );
    assert.equal(events.rows[0]!.count, 1);
  });

  it("rechaza contraseñas cortas con mensaje claro", async () => {
    await seedPasswordUser("short@example.com");
    const issued = await issueAuthToken("short@example.com", "password_reset");
    assert.ok(issued);
    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/set-password",
      headers: ip("short@example.com"),
      payload: { token: issued.token, password: "corta" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_password");
    const tokenStillValid = await db.query<{ used_at: Date | null }>("SELECT used_at FROM auth_tokens");
    assert.equal(tokenStillValid.rows[0]!.used_at, null);
  });

  it("permite un registro completo: token de registration crea contraseña", async () => {
    await app.inject({ method: "POST", url: "/internal/auth/register", headers: ip("fresh@example.com"), payload: { email: "fresh@example.com" } });
    const token = tokenFromLink(extractLink(emailOutbox[0]!));

    const response = await app.inject({
      method: "POST",
      url: "/internal/auth/set-password",
      headers,
      payload: { token, password: GOOD_PASSWORD },
    });
    assert.equal(response.statusCode, 200);

    const login = await app.inject({
      method: "POST",
      url: "/internal/auth/login",
      headers,
      payload: { email: "fresh@example.com", password: GOOD_PASSWORD },
    });
    assert.equal(login.statusCode, 200);
  });
});
