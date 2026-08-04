import "./helpers/setup.js";
import { after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { TOTP } from "otpauth";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";

const { db } = await import("../src/db.js");
const { buildApp } = await import("../src/app.js");
const { truncateAll } = await import("./helpers/db.js");
const { hashPassword } = await import("../src/services/auth-crypto.js");
const {
  loginUser,
  checkSession,
  MfaChallengeError,
  verifyMfaChallenge: verifyMfaSessionChallenge,
} = await import("../src/services/auth-sessions.js");
const {
  confirmTotpEnrollment: confirmTotpEnrollmentService,
  consumeRecoveryCode,
  disableTotp,
  enrollTotp: enrollTotpService,
  regenerateRecoveryCodes,
  resetAdminMfa,
  verifyTotpChallenge,
} = await import("../src/services/auth-mfa.js");

const app = await buildApp();

const TEST_PASSWORD = "correct horse battery staple";
const POLICY = {
  absoluteSeconds: 3_600,
  inactivitySeconds: 1_800,
  rotationSeconds: 60,
};

async function seedUser(email: string, options: { password?: boolean; role?: string } = {}) {
  const passwordHash = options.password ? await hashPassword(TEST_PASSWORD) : null;
  const result = await db.query<{ id: string }>(
    `INSERT INTO users (email, password_hash, global_role)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [email, passwordHash, options.role ?? "user"],
  );
  return result.rows[0]!.id;
}

/** Crea el usuario, hace login y devuelve la sesión completa (sin MFA). */
async function fullLogin(email: string, options: { role?: string } = {}) {
  await seedUser(email, { password: true, role: options.role });
  const login = await loginUser(email, TEST_PASSWORD, POLICY);
  if (login.kind !== "authenticated") throw new Error("Login no autenticado");
  return login.token;
}

/** Enrola TOTP para un usuario sin MFA y devuelve un cliente TOTP listo. */
async function enrollTotp(email: string, options: { role?: string } = {}) {
  await seedUser(email, { password: true, role: options.role });
  const login = await loginUser(email, TEST_PASSWORD, POLICY);
  const token = login.kind === "authenticated"
    ? login.token
    : login.kind === "mfa_required"
      ? login.token
      : null;
  if (!token) throw new Error("Login inesperado");
  const enroll = await inject("POST", "/enroll", email, token, {
    ...(options.role === "admin" ? {} : { password: TEST_PASSWORD }),
  });
  assert.equal(enroll.statusCode, 200);
  const { secretBase32 } = enroll.json<{ secretBase32: string }>();
  const totp = totpForSeconds(secretBase32, 30);
  const confirm = await inject("POST", "/confirm", email, token, { token, code: totp.generate() });
  assert.equal(confirm.statusCode, 200);
  const { recoveryCodes } = confirm.json<{ recoveryCodes: string[] }>();
  return { token, totp, recoveryCodes };
}

function totpForSeconds(secretBase32: string, period: number) {
  return new TOTP({ algorithm: "SHA1", digits: 6, period, secret: secretBase32 });
}

/** Genera un código del período siguiente (dentro de la ventana ±1) para evitar el replay del período vivo. */
function nextPeriodCode(totp: TOTP) {
  const step = Math.floor(Date.now() / 1000 / 30);
  return totp.generate({ timestamp: (step + 1) * 30 * 1000 });
}

async function loginWith(email: string, password = TEST_PASSWORD) {
  return loginUser(email, password, POLICY);
}

const BASE_HEADERS = { "x-internal-token": TEST_INTERNAL_TOKEN };

function clientIp(email: string) {
  return `198.51.100.${email.length % 250 + 1}`;
}

function headersFor(email: string, token?: string) {
  return {
    ...BASE_HEADERS,
    "x-client-ip": clientIp(email),
    ...(token ? { "x-session-token": token } : {}),
  };
}

async function inject(
  method: "GET" | "POST",
  path: string,
  email: string,
  token?: string,
  body?: unknown,
): Promise<Awaited<ReturnType<typeof app.inject>>> {
  const headers = headersFor(email, token) as Record<string, string>;
  if (body) headers["content-type"] = "application/json";
  const response = await app.inject({
    method,
    url: `/internal/auth/mfa${path}`,
    headers,
    payload: body === undefined ? undefined : (JSON.stringify(body) as string),
  });
  return response;
}

beforeEach(async () => {
  await truncateAll();
});

after(async () => {
  await app.close();
});

describe("enrolamiento y confirmación TOTP", () => {
  it("enrola, confirma con código válido y emite 10 códigos de recuperación", async () => {
    const { recoveryCodes } = await enrollTotp("alice@example.com");

    assert.equal(recoveryCodes.length, 10);
    const stored = await db.query<{ count: string }>(
      "SELECT count(*) FROM recovery_codes WHERE used_at IS NULL",
    );
    assert.equal(Number(stored.rows[0]!.count), 10);

    const meta = await db.query<{ confirmed_at: Date | null; last_used_step: string | null }>(
      "SELECT confirmed_at, last_used_step FROM totp_credentials",
    );
    assert.ok(meta.rows[0]!.confirmed_at);
    assert.ok(Number.isInteger(Number(meta.rows[0]!.last_used_step)));
  });

  it("rechaza confirmación con código TOTP inválido", async () => {
    const token = await fullLogin("bob@example.com");
    const enroll = await inject("POST", "/enroll", "bob@example.com", token, { password: TEST_PASSWORD });
    assert.equal(enroll.statusCode, 200);

    const confirm = await inject("POST", "/confirm", "bob@example.com", token, { token, code: "000000" });
    assert.equal(confirm.statusCode, 400);
  });

  it("mantiene el mismo secreto al repetir un enrolamiento pendiente", async () => {
    const token = await fullLogin("pending@example.com");
    const first = await inject("POST", "/enroll", "pending@example.com", token, { password: TEST_PASSWORD });
    const second = await inject("POST", "/enroll", "pending@example.com", token, { password: TEST_PASSWORD });
    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(
      first.json<{ secretBase32: string }>().secretBase32,
      second.json<{ secretBase32: string }>().secretBase32,
    );
  });

  it("no permite enrolar de nuevo tras confirmar", async () => {
    await enrollTotp("carol@example.com");
    const login = await loginWith("carol@example.com");
    assert.equal(login.kind, "mfa_required");
    const enroll = await inject("POST", "/enroll", "carol@example.com", login.token, {});
    assert.equal(enroll.statusCode, 409);
  });

  it("exige la contraseña actual para enrolar TOTP en un usuario normal", async () => {
    const token = await fullLogin("reauth-enroll@example.com");

    const missing = await inject("POST", "/enroll", "reauth-enroll@example.com", token, {});
    assert.equal(missing.statusCode, 401);
    assert.equal(missing.json<{ error: string }>().error, "reauthentication_required");

    const invalid = await inject("POST", "/enroll", "reauth-enroll@example.com", token, {
      password: "incorrect password",
    });
    assert.equal(invalid.statusCode, 401);

    const credentials = await db.query<{ count: string }>(
      "SELECT count(*) FROM totp_credentials",
    );
    assert.equal(Number(credentials.rows[0]!.count), 0);
  });

  it("no permite confirmar nuevamente un TOTP ya activo", async () => {
    const { token, totp } = await enrollTotp("repeat@example.com");
    const repeated = await inject("POST", "/confirm", "repeat@example.com", token, {
      token,
      code: nextPeriodCode(totp),
    });
    assert.equal(repeated.statusCode, 409);
  });

  it("revoca las demás sesiones al confirmar el enrolamiento", async () => {
    await seedUser("sessions@example.com", { password: true });
    const firstLogin = await loginWith("sessions@example.com");
    const secondLogin = await loginWith("sessions@example.com");
    if (firstLogin.kind !== "authenticated" || secondLogin.kind !== "authenticated") {
      throw new Error("Se esperaban sesiones completas");
    }
    const enroll = await inject("POST", "/enroll", "sessions@example.com", firstLogin.token, {
      password: TEST_PASSWORD,
    });
    const { secretBase32 } = enroll.json<{ secretBase32: string }>();
    const confirm = await inject("POST", "/confirm", "sessions@example.com", firstLogin.token, {
      token: firstLogin.token,
      code: totpForSeconds(secretBase32, 30).generate(),
    });
    assert.equal(confirm.statusCode, 200);
    assert.equal((await checkSession(firstLogin.token, POLICY)).kind, "ok");
    assert.equal((await checkSession(secondLogin.token, POLICY)).kind, "invalid");
  });
});

describe("login con MFA", () => {
  it("conserva el nivel restringido de una sesión legacy password", async () => {
    const token = await fullLogin("legacy-password@example.com");
    await db.query("UPDATE auth_sessions SET auth_level = 'password'");

    const session = await checkSession(token, POLICY);
    assert.ok(session.kind === "ok");
    assert.equal(session.user.authLevel, "password");
  });

  it("usuario con TOTP obtiene mfa_required y sesión en nivel mfa", async () => {
    await enrollTotp("dave@example.com");

    const login = await loginWith("dave@example.com");
    assert.equal(login.kind, "mfa_required");

    const session = await checkSession(login.token, POLICY);
    assert.ok(session.kind === "ok");
    assert.equal(session.user.authLevel, "mfa");
    assert.equal(session.user.mfaVerifiedAt, null);
  });

  it("verifica el challenge con TOTP y promueve a full con rotación", async () => {
    const { totp } = await enrollTotp("erin@example.com");
    const login = await loginWith("erin@example.com");
    if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");

    const verify = await inject("POST", "/verify", "erin@example.com", undefined, { token: login.token, code: nextPeriodCode(totp) });
    assert.equal(verify.statusCode, 200);
    const { token, user } = verify.json<{ token: string; user: { authLevel: string; mfaVerifiedAt: string } }>();
    assert.equal(user.authLevel, "full");
    assert.ok(user.mfaVerifiedAt);

    const oldSession = await checkSession(login.token, POLICY);
    assert.equal(oldSession.kind, "invalid");
    const newSession = await checkSession(token, POLICY);
    assert.ok(newSession.kind === "ok" && newSession.user.authLevel === "full");
  });

  it("rechaza replay de un mismo período TOTP ya utilizado", async () => {
    const { totp } = await enrollTotp("frank@example.com");
    const login = await loginWith("frank@example.com");
    if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");
    const code = nextPeriodCode(totp);

    const first = await inject("POST", "/verify", "frank@example.com", undefined, { token: login.token, code });
    assert.equal(first.statusCode, 200);

    const login2 = await loginWith("frank@example.com");
    if (login2.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");
    const replay = await inject("POST", "/verify", "frank@example.com", undefined, { token: login2.token, code });
    assert.equal(replay.statusCode, 401);
  });

  it("acepta una sola verificación concurrente del mismo período TOTP", async () => {
    const { totp } = await enrollTotp("parallel@example.com");
    const firstLogin = await loginWith("parallel@example.com");
    const secondLogin = await loginWith("parallel@example.com");
    if (firstLogin.kind !== "mfa_required" || secondLogin.kind !== "mfa_required") {
      throw new Error("Se esperaban challenges MFA");
    }
    const code = nextPeriodCode(totp);
    const responses = await Promise.all([
      inject("POST", "/verify", "parallel@example.com", undefined, { token: firstLogin.token, code }),
      inject("POST", "/verify", "parallel@example.com", undefined, { token: secondLogin.token, code }),
    ]);
    assert.deepEqual(responses.map((response) => response.statusCode).sort(), [200, 401]);
  });

  it("un código de recuperación se usa una sola vez", async () => {
    const { recoveryCodes } = await enrollTotp("grace@example.com");
    const login = await loginWith("grace@example.com");
    if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");

    const first = await inject("POST", "/verify", "grace@example.com", undefined, { token: login.token, code: recoveryCodes[0]! });
    assert.equal(first.statusCode, 200);

    const login2 = await loginWith("grace@example.com");
    if (login2.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");
    const reuse = await inject("POST", "/verify", "grace@example.com", undefined, { token: login2.token, code: recoveryCodes[0]! });
    assert.equal(reuse.statusCode, 401);
  });

  it("destruye el challenge después de diez intentos fallidos", async () => {
    await enrollTotp("attempts@example.com");
    const login = await loginWith("attempts@example.com");
    if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await assert.rejects(
        verifyMfaSessionChallenge(login.token, async () => {
          throw new Error("invalid code");
        }, POLICY),
        MfaChallengeError,
      );
    }
    let callbackCalled = false;
    await assert.rejects(
      verifyMfaSessionChallenge(login.token, async () => {
        callbackCalled = true;
      }, POLICY),
      MfaChallengeError,
    );
    assert.equal(callbackCalled, false);
  });
});

describe("deshabilitar y regenerar", () => {
  it("un admin no puede desactivar su propia MFA por el portal", async () => {
    const { token } = await enrollTotp("admin@example.com", { role: "admin" });
    const disable = await inject("POST", "/disable", "admin@example.com", token, {
      token,
      password: TEST_PASSWORD,
    });
    assert.equal(disable.statusCode, 403);
  });

  it("un usuario normal puede desactivar MFA tras confirmar su contraseña", async () => {
    const { token } = await enrollTotp("hank@example.com");
    const disable = await inject("POST", "/disable", "hank@example.com", token, {
      token,
      password: TEST_PASSWORD,
    });
    assert.equal(disable.statusCode, 200);
    const relogin = await loginWith("hank@example.com");
    if (relogin.kind !== "authenticated") throw new Error("Se esperaba login sin MFA");
    const mfaStatus = await inject("GET", "/status", "hank@example.com", relogin.token);
    assert.equal(mfaStatus.statusCode, 200);
    assert.equal(mfaStatus.json<{ enabled: boolean }>().enabled, false);
  });

  it("rechaza desactivar MFA sin la contraseña actual", async () => {
    const { token } = await enrollTotp("disable-reauth@example.com");
    const disable = await inject("POST", "/disable", "disable-reauth@example.com", token, {
      token,
      password: "incorrect password",
    });
    assert.equal(disable.statusCode, 401);

    const status = await inject("GET", "/status", "disable-reauth@example.com", token);
    assert.equal(status.statusCode, 200);
    assert.equal(status.json<{ enabled: boolean }>().enabled, true);
  });

  it("regenerar invalida los códigos no usados previos", async () => {
    const { token } = await enrollTotp("idris@example.com");
    const regen = await inject("POST", "/regenerate-codes", "idris@example.com", token, { token });
    assert.equal(regen.statusCode, 200);
    const newCodes = regen.json<{ recoveryCodes: string[] }>().recoveryCodes;
    assert.equal(newCodes.length, 10);
    for (const code of newCodes) {
      const used = await db.query<{ count: string }>(
        "SELECT count(*) FROM recovery_codes WHERE used_at IS NULL",
      );
      assert.equal(Number(used.rows[0]!.count), 10);
    }
  });

  it("un challenge admin no puede generar recovery codes antes de enrolar TOTP", async () => {
    await seedUser("admin-bootstrap@example.com", { password: true, role: "admin" });
    const login = await loginWith("admin-bootstrap@example.com");
    if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");

    const response = await inject(
      "POST",
      "/regenerate-codes",
      "admin-bootstrap@example.com",
      login.token,
      { token: login.token },
    );
    assert.equal(response.statusCode, 403);
    const codes = await db.query<{ count: string }>("SELECT count(*) FROM recovery_codes");
    assert.equal(Number(codes.rows[0]!.count), 0);
  });

  it("el reset administrativo borra MFA, revoca sesiones y registra el motivo", async () => {
    const { recoveryCodes } = await enrollTotp("claudia@example.com", { role: "admin" });
    const login = await loginWith("claudia@example.com");
    if (login.kind !== "mfa_required") throw new Error("Se esperaba mfa_required");
    assert.equal(recoveryCodes.length, 10);

    const revoked = await resetAdminMfa(
      login.user.id,
      "operator",
      "Dispositivo de recuperación del administrador perdido y bloqueado",
    );

    const credential = await db.query<{ count: string }>(
      "SELECT count(*) AS count FROM totp_credentials WHERE user_id = $1",
      [login.user.id],
    );
    assert.equal(Number(credential.rows[0]!.count), 0);
    const codes = await db.query<{ count: string }>(
      "SELECT count(*) AS count FROM recovery_codes WHERE user_id = $1",
      [login.user.id],
    );
    assert.equal(Number(codes.rows[0]!.count), 0);
    assert.ok(revoked >= 2);

    const events = await db.query<{ event_type: string; metadata: { reason: string } }>(
      "SELECT event_type, metadata FROM auth_events WHERE user_id = $1 AND event_type = 'mfa_admin_reset' ORDER BY created_at DESC LIMIT 1",
      [login.user.id],
    );
    assert.equal(events.rows[0]!.event_type, "mfa_admin_reset");
    assert.ok(events.rows[0]!.metadata.reason.includes("perdido y bloqueado"));
  });
});
