import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateOpaqueToken,
  generateRecoveryCodes,
  hashOpaqueToken,
  hashPassword,
  normalizeEmail,
  passwordNeedsRehash,
  validatePassword,
  verifyPassword,
} from "../src/services/auth-crypto.js";

describe("auth crypto", () => {
  it("normaliza email sin reescribir aliases", () => {
    assert.equal(normalizeEmail("  User+tag@Example.COM "), "user+tag@example.com");
  });

  it("aplica límites de contraseña", () => {
    assert.equal(validatePassword("short"), "PASSWORD_TOO_SHORT");
    assert.equal(validatePassword("correct horse battery staple"), null);
    assert.equal(validatePassword("x".repeat(129)), "PASSWORD_TOO_LONG");
  });

  it("genera y verifica hashes Argon2id", async () => {
    const password = "correct horse battery staple";
    const passwordHash = await hashPassword(password);
    assert.match(passwordHash, /^\$argon2id\$/);
    assert.equal(passwordHash.includes(password), false);
    assert.equal(await verifyPassword(passwordHash, password), true);
    assert.equal(await verifyPassword(passwordHash, "another password"), false);
    assert.equal(passwordNeedsRehash(passwordHash), false);
  });

  it("genera tokens opacos y conserva solo hashes de 32 bytes", () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();
    assert.notEqual(first.token, second.token);
    assert.equal(first.tokenHash.length, 32);
    assert.deepEqual(first.tokenHash, hashOpaqueToken(first.token));
    assert.notDeepEqual(first.tokenHash, second.tokenHash);
  });

  it("cifra secretos TOTP ligados al usuario y versión", () => {
    const key = randomBytes(32);
    const userId = randomUUID();
    const encrypted = encryptTotpSecret("JBSWY3DPEHPK3PXP", key, 1, userId);
    assert.equal(encrypted.nonce.length, 12);
    assert.equal(encrypted.tag.length, 16);
    assert.equal(decryptTotpSecret(encrypted, key, userId), "JBSWY3DPEHPK3PXP");
    assert.throws(() => decryptTotpSecret(encrypted, key, randomUUID()));
    assert.throws(() => decryptTotpSecret(encrypted, randomBytes(32), userId));
  });

  it("genera códigos de recuperación únicos y hashes no reversibles", () => {
    const codes = generateRecoveryCodes("test-recovery-pepper-with-32-bytes-minimum");
    assert.equal(codes.length, 10);
    assert.equal(new Set(codes.map(({ code }) => code)).size, 10);
    for (const { code, codeHash } of codes) {
      assert.equal(codeHash.length, 32);
      assert.equal(codeHash.toString("utf8").includes(code), false);
    }
  });
});
