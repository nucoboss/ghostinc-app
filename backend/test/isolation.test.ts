import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TEST_INTERNAL_TOKEN, newTestApiKey } from "./helpers/setup.js";

const { buildApp } = await import("../src/app.js");
const { db } = await import("../src/db.js");
const { hashPassword } = await import("../src/services/auth-crypto.js");
const { loginUser } = await import("../src/services/auth-sessions.js");
const { hashApiKey, logApiRequest, refundCredit, reserveCredit } = await import("../src/services/credits.js");
const { requireSessionUser } = await import("../src/lib/authorize.js");
const { apiRequestRows, creditBalance, ledgerDelta, truncateAll } = await import("./helpers/db.js");

const app = await buildApp();

const PASSWORD = "correct horse battery staple";

async function createAccount(email: string, credits: number) {
  const passwordHash = await hashPassword(PASSWORD);
  const user = await db.query<{ id: string }>(
    "INSERT INTO users (email, password_hash, credit_balance) VALUES ($1, $2, $3) RETURNING id",
    [email, passwordHash, credits],
  );
  const apiKey = newTestApiKey();
  await db.query(
    "INSERT INTO api_keys (user_id, name, key_hash, prefix, last_four) VALUES ($1, 'clave-aislamiento', $2, 'pjud', $3)",
    [user.rows[0]!.id, hashApiKey(apiKey), apiKey.slice(-4)],
  );
  const login = await loginUser(email, PASSWORD);
  if (login.kind !== "authenticated") throw new Error("Se esperaba sesión completa sin TOTP");
  return { id: user.rows[0]!.id, apiKey, sessionToken: login.token };
}

let accountA: Awaited<ReturnType<typeof createAccount>>;
let accountB: Awaited<ReturnType<typeof createAccount>>;

before(async () => {
  await truncateAll();
  accountA = await createAccount("aislamiento-a@example.test", 5);
  accountB = await createAccount("aislamiento-b@example.test", 3);
});

after(async () => {
  await app.close();
});

describe("aislamiento de cuentas individuales", () => {
  it("la identidad canónica proviene de la sesión y no de parámetros", async () => {
    const userFromSessionA = await requireSessionUser(accountA.sessionToken);
    const userFromSessionB = await requireSessionUser(accountB.sessionToken);
    assert.equal(userFromSessionA.id, accountA.id);
    assert.equal(userFromSessionB.id, accountB.id);
    assert.notEqual(accountA.id, accountB.id);
  });

  it("el consumo de créditos solo afecta al dueño de la clave", async () => {
    const reservation = await reserveCredit(accountA.apiKey);
    assert.ok(reservation);
    assert.equal(reservation!.userId, accountA.id);

    assert.equal(await creditBalance(accountA.id), 4);
    assert.equal(await creditBalance(accountB.id), 3);
    assert.equal(await ledgerDelta(accountA.id), -1);
    assert.equal(await ledgerDelta(accountB.id), 0);

    await logApiRequest({ reservation: reservation!, requestId: "isolation-a-1", statusCode: 200, durationMs: 10 });
    assert.equal((await apiRequestRows(accountA.id)).length, 1);
    assert.equal((await apiRequestRows(accountB.id)).length, 0);

    await refundCredit(reservation!);
    assert.equal(await creditBalance(accountA.id), 5);
    assert.equal(await creditBalance(accountB.id), 3);
    assert.equal(await ledgerDelta(accountA.id), 0);
    assert.equal(await ledgerDelta(accountB.id), 0);
  });

  it("una clave no puede gastar ni registrar consumo de otra cuenta", async () => {
    const reservationB = await reserveCredit(accountB.apiKey);
    assert.ok(reservationB);
    assert.equal(reservationB!.userId, accountB.id);

    assert.equal(await creditBalance(accountA.id), 5);
    assert.equal(await creditBalance(accountB.id), 2);
    assert.equal(await ledgerDelta(accountA.id), 0);
    assert.equal(await ledgerDelta(accountB.id), -1);

    const rowsB = await apiRequestRows(accountB.id);
    assert.equal(rowsB.length, 0);
    const baselineRequestsA = (await apiRequestRows(accountA.id)).length;
    await logApiRequest({ reservation: reservationB!, requestId: "isolation-b-1", statusCode: 200, durationMs: 5 });
    assert.equal((await apiRequestRows(accountA.id)).length, baselineRequestsA);
    assert.equal((await apiRequestRows(accountB.id)).length, 1);

    await refundCredit(reservationB!);
  });

  it("una consulta filtrada por la identidad de sesión no ve claves de otras cuentas", async () => {
    const keysOfA = await db.query<{ id: string }>(
      "SELECT id FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL",
      [(await requireSessionUser(accountA.sessionToken)).id],
    );
    const keysOfB = await db.query<{ id: string }>(
      "SELECT id FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL",
      [(await requireSessionUser(accountB.sessionToken)).id],
    );
    assert.equal(keysOfA.rows.length, 1);
    assert.equal(keysOfB.rows.length, 1);
    assert.notEqual(keysOfA.rows[0]!.id, keysOfB.rows[0]!.id);
    assert.ok(!keysOfA.rows.some((row) => row.id === keysOfB.rows[0]!.id));
  });

  it("un usuario común no puede usar rutas administrativas aunque tenga sesión completa", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/internal/admin/overview",
      headers: { "x-internal-token": TEST_INTERNAL_TOKEN, "x-session-token": accountB.sessionToken },
    });
    assert.equal(response.statusCode, 403);
  });

  it("los cambios sensibles de cuenta quedan auditados", async () => {
    const { setUserPassword } = await import("../src/services/auth-store.js");
    await setUserPassword(accountA.id, "nueva contraseña segura 123");

    const events = await db.query<{ event_type: string }>(
      "SELECT event_type FROM auth_events WHERE user_id = $1 AND event_type IN ('login', 'password_changed') ORDER BY created_at",
      [accountA.id],
    );
    const types = events.rows.map((row) => row.event_type);
    assert.ok(types.includes("login"));
    assert.ok(types.includes("password_changed"));
  });
});
