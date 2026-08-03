import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";
import { truncateAll } from "./helpers/db.js";

const { buildApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { hashPassword } = await import("../src/services/auth-crypto.js");
const { loginUser } = await import("../src/services/auth-sessions.js");
const app = await buildApp();
let adminSessionToken = "";

before(async () => {
  await truncateAll();
  const password = "correct horse battery staple";
  const passwordHash = await hashPassword(password);
  await db.query(
    "INSERT INTO users (email, password_hash, global_role) VALUES ('admin@example.com', $1, 'admin')",
    [passwordHash],
  );
  adminSessionToken = (await loginUser("admin@example.com", password)).token;
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
    assert.ok(body.data.metrics.organizations === 0);
    assert.ok(Array.isArray(body.data.activity));
    assert.ok(Array.isArray(body.data.organizations));
  });
});
