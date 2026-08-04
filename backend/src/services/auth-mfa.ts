import { randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";
import { db } from "../db.js";
import { config } from "../config.js";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateRecoveryCodes,
  hashOpaqueToken,
  hashRecoveryCode,
} from "./auth-crypto.js";

const TOTP_SECRET_BYTES = 20;
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;
const RECOVERY_CODE_COUNT = 10;

export class MfaError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
  }
}

function totpInstance(secretBase32: string) {
  return new TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: TOTP_PERIOD_SECONDS,
    secret: secretBase32,
  });
}

export function totpUri(secretBase32: string, accountName: string) {
  return new TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: TOTP_PERIOD_SECONDS,
    secret: secretBase32,
    issuer: "Ghostinc",
    label: accountName,
  }).toString();
}

export async function totpConfirmed(userId: string) {
  const result = await db.query<{ confirmed: boolean }>(
    "SELECT (confirmed_at IS NOT NULL) AS confirmed FROM totp_credentials WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]?.confirmed ?? false;
}

async function readTotpCredential(client: { query: typeof db.query }, userId: string) {
  const result = await client.query<{
    secret_ciphertext: Buffer;
    secret_nonce: Buffer;
    secret_tag: Buffer;
    key_version: number;
    confirmed_at: Date | null;
    last_used_step: string | null;
  }>(
    "SELECT secret_ciphertext, secret_nonce, secret_tag, key_version, confirmed_at, last_used_step FROM totp_credentials WHERE user_id = $1 FOR UPDATE",
    [userId],
  );
  return result.rows[0] ?? null;
}

function verifyTotpCode(secretBase32: string, code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  const totp = totpInstance(secretBase32);
  const step = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  for (let delta = -TOTP_WINDOW_STEPS; delta <= TOTP_WINDOW_STEPS; delta += 1) {
    const candidate = totp.generate({ timestamp: (step + delta) * TOTP_PERIOD_SECONDS * 1000 });
    if (candidate === code) return step + delta;
  }
  return null;
}

export async function enrollTotp(userId: string, accountName: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [userId]);
    const existing = await readTotpCredential(client, userId);
    if (existing?.confirmed_at) {
      throw new MfaError("TOTP ya está activo.", "TOTP_ALREADY_ENABLED");
    }

    let secretBase32: string;
    if (existing) {
      secretBase32 = decryptTotpSecret(
        {
          ciphertext: existing.secret_ciphertext,
          nonce: existing.secret_nonce,
          tag: existing.secret_tag,
          keyVersion: existing.key_version,
        },
        config.totpEncryptionKey,
        userId,
      );
    } else {
      const secretBytes = randomBytes(TOTP_SECRET_BYTES);
      const secret = new Secret({
        buffer: secretBytes.buffer.slice(
          secretBytes.byteOffset,
          secretBytes.byteOffset + secretBytes.byteLength,
        ) as ArrayBuffer,
      });
      secretBase32 = secret.base32;
      const encrypted = encryptTotpSecret(secretBase32, config.totpEncryptionKey, 1, userId);
      await client.query(
        `INSERT INTO totp_credentials
           (user_id, secret_ciphertext, secret_nonce, secret_tag, key_version)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, encrypted.ciphertext, encrypted.nonce, encrypted.tag, encrypted.keyVersion],
      );
    }

    await client.query("COMMIT");
    return {
      secretBase32,
      uri: totpUri(secretBase32, accountName),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function confirmTotpEnrollment(userId: string, code: string, sessionToken: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const credential = await readTotpCredential(client, userId);
    if (!credential) throw new MfaError("Sin enrolamiento pendiente.", "TOTP_NOT_ENROLLED");
    if (credential.confirmed_at) throw new MfaError("TOTP ya está activo.", "TOTP_ALREADY_ENABLED");
    const secret = decryptTotpSecret(
      {
        ciphertext: credential.secret_ciphertext,
        nonce: credential.secret_nonce,
        tag: credential.secret_tag,
        keyVersion: credential.key_version,
      },
      config.totpEncryptionKey,
      userId,
    );
    const step = verifyTotpCode(secret, code);
    if (step === null) throw new MfaError("Código TOTP inválido.", "INVALID_TOTP_CODE");

    await client.query(
      "UPDATE totp_credentials SET confirmed_at = now(), last_used_step = $2 WHERE user_id = $1",
      [userId, step],
    );
    const codes = generateRecoveryCodes(config.recoveryCodePepper, RECOVERY_CODE_COUNT);
    for (const codeEntry of codes) {
      await client.query(
        "INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)",
        [userId, codeEntry.codeHash],
      );
    }
    await client.query(
      "INSERT INTO auth_events (user_id, event_type, metadata) VALUES ($1, 'mfa_enrolled', $2)",
      [userId, JSON.stringify({ mfa_type: "totp" })],
    );
    await client.query(
      `UPDATE auth_sessions SET revoked_at = now()
       WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL`,
      [userId, hashOpaqueToken(sessionToken)],
    );
    await client.query("COMMIT");
    return codes.map((entry) => entry.code);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyTotpChallenge(userId: string, code: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const credential = await readTotpCredential(client, userId);
    if (!credential || !credential.confirmed_at) {
      throw new MfaError("MFA no configurado.", "MFA_NOT_ENABLED");
    }
    const secret = decryptTotpSecret(
      {
        ciphertext: credential.secret_ciphertext,
        nonce: credential.secret_nonce,
        tag: credential.secret_tag,
        keyVersion: credential.key_version,
      },
      config.totpEncryptionKey,
      userId,
    );
    const step = verifyTotpCode(secret, code);
    if (step === null) {
      throw new MfaError("Código TOTP inválido.", "INVALID_TOTP_CODE");
    }
    if (credential.last_used_step !== null && step <= Number(credential.last_used_step)) {
      throw new MfaError("Código ya utilizado.", "TOTP_REPLAY");
    }
    await client.query(
      "UPDATE totp_credentials SET last_used_step = $2 WHERE user_id = $1",
      [userId, step],
    );
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'mfa_verified')",
      [userId],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function consumeRecoveryCode(userId: string, code: string) {
  const codeHash = hashRecoveryCode(code, config.recoveryCodePepper);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE recovery_codes SET used_at = now()
       WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
       RETURNING id`,
      [userId, codeHash],
    );
    if (!result.rowCount) throw new MfaError("Código de recuperación inválido.", "INVALID_RECOVERY_CODE");
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'recovery_code_used')",
      [userId],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function regenerateRecoveryCodes(userId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL",
      [userId],
    );
    const codes = generateRecoveryCodes(config.recoveryCodePepper, RECOVERY_CODE_COUNT);
    for (const codeEntry of codes) {
      await client.query(
        "INSERT INTO recovery_codes (user_id, code_hash) VALUES ($1, $2)",
        [userId, codeEntry.codeHash],
      );
    }
    await client.query(
      "INSERT INTO auth_events (user_id, event_type) VALUES ($1, 'recovery_codes_regenerated')",
      [userId],
    );
    await client.query("COMMIT");
    return codes.map((entry) => entry.code);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function disableTotp(userId: string, actorUserId: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM totp_credentials WHERE user_id = $1", [userId]);
    await client.query(
      "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
      [userId],
    );
    await client.query(
      "INSERT INTO auth_events (user_id, actor_user_id, event_type, metadata) VALUES ($1, $2, 'mfa_disabled', $3)",
      [userId, actorUserId, JSON.stringify({ mfa_type: "totp" })],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Procedimiento auditado de recuperación: borra MFA, revoca sesiones y registra motivo. */
export async function resetAdminMfa(userId: string, actor: string, reason: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM recovery_codes WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM totp_credentials WHERE user_id = $1", [userId]);
    const revoked = await client.query<{ id: string }>(
      "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id",
      [userId],
    );
    await client.query(
      `INSERT INTO auth_events (user_id, actor_user_id, event_type, metadata)
       VALUES ($1, NULL, 'mfa_admin_reset', $2)`,
      [userId, JSON.stringify({ actor, reason, revoked_sessions: revoked.rowCount })],
    );
    await client.query("COMMIT");
    return revoked.rowCount ?? 0;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
