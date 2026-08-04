import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { hasInternalAccess, internalRateKey } from "../lib/internal-auth.js";
import { validatePassword } from "../services/auth-crypto.js";
import {
  LoginFailedError,
  checkSession,
  loginUser,
  revokeSession,
} from "../services/auth-sessions.js";
import { TokenError, consumeAuthToken, issueAuthToken } from "../services/auth-tokens.js";
import { sendAuthEmail } from "../services/email.js";

const loginBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["email", "password"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const sessionBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const emailBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["email"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 254 },
  },
} as const;

const setPasswordBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token", "password"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
    password: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const GENERIC_EMAIL_RESPONSE = { ok: true, message: "Si el correo existe, recibirás un enlace de acceso." };

async function sendTokenEmail(
  email: string,
  kind: "registration" | "password_reset",
  logger: Pick<FastifyInstance["log"], "error">,
  transport?: Parameters<typeof sendAuthEmail>[1],
) {
  const issued = await issueAuthToken(email, kind);
  if (!issued) return null;
  const mode = kind === "registration" ? "registration" : "reset";
  const link = new URL("/crear-contrasena", config.appBaseUrl);
  link.hash = new URLSearchParams({ token: issued.token, mode }).toString();
  void sendAuthEmail({
    to: issued.email,
    link: link.toString(),
    expiredAt: issued.expiresAt,
    kind,
  }, transport).catch(() => {
    logger.error({ kind }, "Auth email delivery failed");
  });
  return issued;
}

export async function authRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    if (!hasInternalAccess(request)) {
      return reply.code(401).send({ error: "unauthorized", message: "Acceso interno no autorizado." });
    }
  });

  app.post("/login", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: loginBodySchema,
      response: {
        200: {
          type: "object",
          additionalProperties: false,
          required: ["status", "token", "user"],
          properties: {
            status: { type: "string", enum: ["authenticated", "mfa_required"] },
            token: { type: "string" },
            user: { $ref: "user" },
            mfaEnrollmentRequired: { type: "boolean" },
          },
        },
        400: { $ref: "error" },
        401: { $ref: "error" },
        429: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { email: string; password: string };
    try {
      const result = await loginUser(body.email, body.password);
      if (result.kind === "mfa_required") {
        return reply.code(200).send({
          status: "mfa_required",
          token: result.token,
          user: result.user,
          mfaEnrollmentRequired: result.mfaEnrollmentRequired,
        });
      }
      return { status: "authenticated", token: result.token, user: result.user };
    } catch (error) {
      if (error instanceof LoginFailedError) {
        return reply.code(401).send({ error: "invalid_credentials", message: "Credenciales inválidas." });
      }
      throw error;
    }
  });

  app.post("/register", {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: emailBodySchema,
      response: {
        400: { $ref: "error" },
        429: { $ref: "error" },
      },
    },
  }, async (request) => {
    const body = request.body as { email: string };
    await sendTokenEmail(body.email, "registration", request.log);
    return GENERIC_EMAIL_RESPONSE;
  });

  app.post("/recovery", {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: emailBodySchema,
      response: {
        400: { $ref: "error" },
        429: { $ref: "error" },
      },
    },
  }, async (request) => {
    const body = request.body as { email: string };
    await sendTokenEmail(body.email, "password_reset", request.log);
    return GENERIC_EMAIL_RESPONSE;
  });

  app.post("/set-password", {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: setPasswordBodySchema,
      response: {
        400: { $ref: "error" },
        429: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string; password: string };
    const passwordError = validatePassword(body.password);
    if (passwordError) {
      return reply.code(400).send({
        error: "invalid_password",
        message: passwordError === "PASSWORD_TOO_SHORT"
          ? "La contraseña debe tener al menos 12 caracteres."
          : "La contraseña es demasiado larga.",
      });
    }
    try {
      await consumeAuthToken(body.token, body.password);
    } catch (error) {
      if (error instanceof TokenError) {
        return reply.code(400).send({ error: "invalid_token", message: "El enlace no es válido o ya fue usado." });
      }
      throw error;
    }
    return { ok: true };
  });

  app.post("/session", {
    config: {
      rateLimit: {
        max: 120,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: sessionBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        429: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string };
    const result = await checkSession(body.token);
    if (result.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    return { user: result.user };
  });

  app.post("/session/rotate", {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: sessionBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        429: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string };
    const result = await checkSession(body.token, undefined, true);
    if (result.kind !== "ok") {
      return reply.code(401).send({ error: "unauthorized", message: "Sesión no válida." });
    }
    return { user: result.user, token: result.token };
  });

  app.post("/logout", {
    schema: {
      body: sessionBodySchema,
      response: {
        400: { $ref: "error" },
        200: {
          type: "object",
          additionalProperties: false,
          required: ["ok"],
          properties: { ok: { type: "boolean" } },
        },
      },
    },
  }, async (request) => {
    const body = request.body as { token: string };
    await revokeSession(body.token);
    return { ok: true };
  });
}
