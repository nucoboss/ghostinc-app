import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";
import argon2 from "argon2";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

const TOKEN_BYTES = 32;
const TOTP_NONCE_BYTES = 12;

export type EncryptedSecret = {
  ciphertext: Buffer;
  nonce: Buffer;
  tag: Buffer;
  keyVersion: number;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string) {
  const characters = Array.from(password).length;
  const bytes = Buffer.byteLength(password, "utf8");
  if (characters < 12) return "PASSWORD_TOO_SHORT";
  if (characters > 128 || bytes > 1_024) return "PASSWORD_TOO_LONG";
  return null;
}

export async function hashPassword(password: string) {
  const validationError = validatePassword(password);
  if (validationError) throw new Error(validationError);
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string) {
  try {
    return await argon2.verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function passwordNeedsRehash(passwordHash: string) {
  return argon2.needsRehash(passwordHash, ARGON2_OPTIONS);
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

export function generateOpaqueToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashOpaqueToken(token) };
}

function assertEncryptionKey(key: Buffer) {
  if (key.length !== 32) throw new Error("TOTP_ENCRYPTION_KEY_INVALID");
}

function totpAad(userId: string, keyVersion: number) {
  return Buffer.from(`${userId}:${keyVersion}`, "utf8");
}

export function encryptTotpSecret(secret: string, key: Buffer, keyVersion: number, userId: string): EncryptedSecret {
  assertEncryptionKey(key);
  if (!Number.isInteger(keyVersion) || keyVersion < 1) throw new Error("TOTP_KEY_VERSION_INVALID");
  const nonce = randomBytes(TOTP_NONCE_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(totpAad(userId, keyVersion));
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return { ciphertext, nonce, tag: cipher.getAuthTag(), keyVersion };
}

export function decryptTotpSecret(encrypted: EncryptedSecret, key: Buffer, userId: string) {
  assertEncryptionKey(key);
  const decipher = createDecipheriv("aes-256-gcm", key, encrypted.nonce);
  decipher.setAAD(totpAad(userId, encrypted.keyVersion));
  decipher.setAuthTag(encrypted.tag);
  return Buffer.concat([decipher.update(encrypted.ciphertext), decipher.final()]).toString("utf8");
}

function recoveryPepper(pepper: string | Buffer) {
  const value = Buffer.isBuffer(pepper) ? pepper : Buffer.from(pepper, "utf8");
  if (value.length < 32) throw new Error("RECOVERY_CODE_PEPPER_INVALID");
  return value;
}

export function hashRecoveryCode(code: string, pepper: string | Buffer) {
  return createHmac("sha256", recoveryPepper(pepper)).update(code, "utf8").digest();
}

export function generateRecoveryCodes(pepper: string | Buffer, count = 10) {
  if (!Number.isInteger(count) || count < 1 || count > 20) throw new Error("RECOVERY_CODE_COUNT_INVALID");
  return Array.from({ length: count }, () => {
    const code = randomBytes(16).toString("base64url");
    return { code, codeHash: hashRecoveryCode(code, pepper) };
  });
}
