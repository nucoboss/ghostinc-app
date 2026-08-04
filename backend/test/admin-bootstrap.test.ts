import "./helpers/setup.js";
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { truncateAll } from "./helpers/db.js";

const { db } = await import("../src/db.js");
const { createInitialAdminInvite, TokenError } = await import("../src/services/auth-tokens.js");

beforeEach(async () => {
  await truncateAll();
});

describe("bootstrap del primer administrador", () => {
  it("crea un único admin sin contraseña predefinida", async () => {
    const invite = await createInitialAdminInvite("FIRST.ADMIN@example.com");
    assert.ok(invite.token.length >= 32);
    assert.equal(invite.email, "first.admin@example.com");

    const user = await db.query<{ global_role: string; password_hash: string | null }>(
      "SELECT global_role, password_hash FROM users WHERE id = $1",
      [invite.userId],
    );
    assert.equal(user.rows[0]!.global_role, "admin");
    assert.equal(user.rows[0]!.password_hash, null);
  });

  it("rechaza otro bootstrap cuando ya existe un admin", async () => {
    await createInitialAdminInvite("first@example.com");
    await assert.rejects(
      createInitialAdminInvite("second@example.com"),
      (error: unknown) => error instanceof TokenError && error.message === "ADMIN_ALREADY_EXISTS",
    );
  });

  it("no promueve una identidad preexistente por coincidencia de email", async () => {
    await db.query("INSERT INTO users (email) VALUES ('existing@example.com')");
    await assert.rejects(
      createInitialAdminInvite("existing@example.com"),
      (error: unknown) => error instanceof TokenError && error.message === "IDENTITY_ALREADY_EXISTS",
    );
    const user = await db.query<{ global_role: string }>(
      "SELECT global_role FROM users WHERE email = 'existing@example.com'",
    );
    assert.equal(user.rows[0]!.global_role, "user");
  });
});
