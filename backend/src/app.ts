import type { FastifyError, FastifyRequest, FastifyReply } from "fastify";
import Fastify, { LogController } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { db } from "./db.js";
import { authRoutes } from "./routes/auth.js";
import { causasRoutes } from "./routes/causas.js";
import { adminRoutes } from "./routes/admin.js";
import { mfaRoutes } from "./routes/mfa.js";
import { errorResponseSchema } from "./schemas/causas.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
    requestIdHeader: "x-request-id",
    bodyLimit: 4096,
    requestTimeout: 20_000,
    keepAliveTimeout: 5_000,
    logController: new LogController({ disableRequestLogging: true }),
    ajv: {
      customOptions: {
        removeAdditional: false,
        coerceTypes: true,
      },
    },
  });

  app.addSchema({ $id: "error", ...errorResponseSchema });

  app.addSchema({
    $id: "user",
    type: "object",
    additionalProperties: false,
    required: ["id", "email", "globalRole", "emailVerified", "authLevel", "mfaVerifiedAt"],
    properties: {
      id: { type: "string" },
      email: { type: "string" },
      globalRole: { type: "string", enum: ["user", "admin"] },
      emailVerified: { type: "boolean" },
      authLevel: { type: "string", enum: ["password", "mfa", "full"] },
      mfaVerifiedAt: { type: ["string", "null"] },
    },
  });

  app.setNotFoundHandler((_request, reply) => {
    return reply.code(404).send({ error: "not_found", message: "Recurso no encontrado." });
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error.validation) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Parámetros inválidos.",
        details: error.validation.map((item) => ({
          field: item.instancePath,
          keyword: item.keyword,
          message: item.message,
        })),
      });
    }

    const statusCode = error.statusCode ?? 500;

    if (statusCode === 429) {
      return reply.code(429).send({ error: "rate_limited", message: "Demasiadas solicitudes. Intenta nuevamente en un minuto." });
    }

    if (statusCode === 404) {
      return reply.code(404).send({ error: "not_found", message: "Recurso no encontrado." });
    }

    if (statusCode >= 500) {
      request.log.error({ err: error }, "internal_error");
      return reply.code(500).send({ error: "internal_error", message: "Error interno del servidor." });
    }

    return reply.code(statusCode).send({ error: "request_error", message: "Solicitud no válida." });
  });

  await app.register(helmet);
  await app.register(cors, {
    origin: (origin, callback) => callback(null, !origin || config.frontendOrigins.includes(origin)),
    methods: ["GET", "OPTIONS"],
  });
  await app.register(rateLimit, { global: false });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      method: request.method,
      route: request.routeOptions.url,
      statusCode: reply.statusCode,
      responseTime: reply.elapsedTime,
    }, "request completed");
  });

  app.get("/health/live", async () => ({ status: "ok" }));
  app.get("/health/ready", async (_request, reply) => {
    try {
      await db.query("SELECT 1");
      return { status: "ready" };
    } catch {
      return reply.code(503).send({ status: "unavailable" });
    }
  });

  await app.register(causasRoutes);
  await app.register(authRoutes, { prefix: "/internal/auth" });
  await app.register(mfaRoutes, { prefix: "/internal/auth/mfa" });
  await app.register(adminRoutes, { prefix: "/internal/admin" });
  app.addHook("onClose", async () => db.end());
  return app;
}
