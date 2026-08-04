import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { hasInternalAccess, internalRateKey } from "../lib/internal-auth.js";
import {
  checkSession,
  ReauthenticationError,
  reauthenticateUser,
  verifyMfaChallenge,
} from "../services/auth-sessions.js";
import { MfaChallengeError } from "../services/auth-sessions.js";
import {
  confirmTotpEnrollment,
  consumeRecoveryCode,
  disableTotp,
  enrollTotp,
  MfaError,
  regenerateRecoveryCodes,
  totpConfirmed,
  verifyTotpChallenge,
} from "../services/auth-mfa.js";

const tokenBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const verifyBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token", "code"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
    code: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const enrollBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const reauthenticationBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token", "password"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

function sessionTokenFrom(request: { headers: Record<string, string | string[] | undefined> }) {
  const value = request.headers["x-session-token"];
  return typeof value === "string" ? value : "";
}

export async function mfaRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    if (!hasInternalAccess(request)) {
      return reply.code(401).send({ error: "unauthorized", message: "Acceso interno no autorizado." });
    }
  });

  app.post("/enroll", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: enrollBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        403: { $ref: "error" },
        409: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = (request.body ?? {}) as { password?: string };
    const session = await checkSession(sessionTokenFrom(request));
    if (session.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    if (await totpConfirmed(session.user.id)) {
      return reply.code(409).send({ error: "totp_already_enabled", message: "TOTP ya está activo." });
    }
    try {
      if (session.user.globalRole !== "admin") {
        if (!body.password) {
          return reply.code(401).send({
            error: "reauthentication_required",
            message: "Confirma tu contraseña para configurar TOTP.",
          });
        }
        await reauthenticateUser(session.user.id, body.password);
      }
      return await enrollTotp(session.user.id, session.user.email);
    } catch (error) {
      if (error instanceof ReauthenticationError) {
        return reply.code(401).send({
          error: "invalid_credentials",
          message: "La contraseña no es válida.",
        });
      }
      if (error instanceof MfaError && error.code === "TOTP_ALREADY_ENABLED") {
        return reply.code(409).send({ error: "totp_already_enabled", message: "TOTP ya está activo." });
      }
      throw error;
    }
  });

  app.post("/confirm", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: verifyBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        409: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string; code: string };
    const session = await checkSession(body.token);
    if (session.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    try {
      const codes = await confirmTotpEnrollment(session.user.id, body.code, body.token);
      return { recoveryCodes: codes };
    } catch (error) {
      if (error instanceof MfaError && error.code === "INVALID_TOTP_CODE") {
        return reply.code(400).send({ error: "invalid_code", message: "Código TOTP inválido." });
      }
      if (error instanceof MfaError && error.code === "TOTP_ALREADY_ENABLED") {
        return reply.code(409).send({ error: "totp_already_enabled", message: "TOTP ya está activo." });
      }
      throw error;
    }
  });

  app.post("/verify", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: verifyBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string; code: string };
    try {
      const result = await verifyMfaChallenge(body.token, async (session) => {
        try {
          await verifyTotpChallenge(session.userId, body.code);
        } catch (error) {
          if (error instanceof MfaError && error.code === "MFA_NOT_ENABLED") {
            await consumeRecoveryCode(session.userId, body.code);
            return;
          }
          if (error instanceof MfaError && error.code === "INVALID_TOTP_CODE") {
            await consumeRecoveryCode(session.userId, body.code);
            return;
          }
          throw error;
        }
      });
      return { token: result.token, user: result.user };
    } catch (error) {
      if (error instanceof MfaError) {
        return reply.code(400).send({ error: "invalid_code", message: "Código inválido." });
      }
      if (error instanceof MfaChallengeError) {
        return reply.code(401).send({ error: "invalid_challenge", message: "Desafío MFA no válido." });
      }
      throw error;
    }
  });

  app.post("/disable", {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: reauthenticationBodySchema,
      response: {
        401: { $ref: "error" },
        403: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string; password: string };
    const session = await checkSession(body.token);
    if (session.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    if (session.user.globalRole === "admin") {
      return reply.code(403).send({
        error: "admin_mfa_required",
        message: "Un administrador no puede desactivar su propia MFA por el portal.",
      });
    }
    try {
      await reauthenticateUser(session.user.id, body.password);
    } catch (error) {
      if (error instanceof ReauthenticationError) {
        return reply.code(401).send({
          error: "invalid_credentials",
          message: "La contraseña no es válida.",
        });
      }
      throw error;
    }
    await disableTotp(session.user.id, session.user.id);
    return { ok: true };
  });

  app.post("/regenerate-codes", {
    schema: {
      body: tokenBodySchema,
      response: {
        401: { $ref: "error" },
        403: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string };
    const session = await checkSession(body.token);
    if (session.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    if (session.user.authLevel !== "full" || !await totpConfirmed(session.user.id)) {
      return reply.code(403).send({
        error: "mfa_required",
        message: "Completa MFA antes de regenerar códigos de recuperación.",
      });
    }
    const codes = await regenerateRecoveryCodes(session.user.id);
    return { recoveryCodes: codes };
  });

  app.get("/status", async (request, reply) => {
    const session = await checkSession(sessionTokenFrom(request));
    if (session.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    const [enabled, reservedCodes] = await Promise.all([
      totpConfirmed(session.user.id),
      db.query<{ count: string }>(
        "SELECT count(*) FROM recovery_codes WHERE user_id = $1 AND used_at IS NULL",
        [session.user.id],
      ),
    ]);
    return {
      enabled,
      recoveryCodesAvailable: Number(reservedCodes.rows[0]?.count ?? 0),
    };
  });
}
