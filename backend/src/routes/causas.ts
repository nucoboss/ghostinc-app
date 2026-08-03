import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasInternalAccess, internalRateKey } from "../lib/internal-auth.js";
import { isValidRut, normalizeRut } from "../lib/rut.js";
import { apiKeyHeadersSchema, paidQuerySchema, rutParamsSchema } from "../schemas/causas.js";
import { logApiRequest, refundCredit, reserveCredit } from "../services/credits.js";
import {
  PjudError,
  searchPjud,
  searchPjudCompany,
  searchPjudCompanySuggestions,
} from "../services/pjud.js";

type CausaRequest = FastifyRequest<{
  Params: { rut: string };
  Querystring: Record<string, unknown>;
}>;

type FreeSearchBody = { kind: "rut" | "company"; query: string };

const FREE_FILTERS = { estado: "abiertas", participacion: "demandado", limit: 10 } as const;

const freeSearchBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "query"],
  properties: {
    kind: { type: "string", enum: ["rut", "company"] },
    query: { type: "string", minLength: 2, maxLength: 120 },
  },
} as const;

const suggestionsBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["query"],
  properties: {
    query: { type: "string", minLength: 3, maxLength: 120 },
  },
} as const;

function emptyResult() {
  return {
    data: {
      summary: {
        total: 0,
        total_demandante: 0,
        total_demandado: 0,
        total_abiertas: 0,
        total_cerradas: 0,
        total_por_competencia: {},
        tribunales: 0,
        fecha_desde: null,
        fecha_hasta: null,
        count: 0,
        limit: 10,
        offset: 0,
      },
      causas: [],
    },
  };
}

function sendProviderError(error: unknown, reply: FastifyReply) {
  if (error instanceof PjudError) return reply.code(error.statusCode).send({ error: "upstream_error", message: error.message });
  return reply.code(502).send({ error: "upstream_error", message: "No fue posible completar la consulta." });
}

export async function causasRoutes(app: FastifyInstance) {
  app.post<{ Body: FreeSearchBody }>("/internal/v1/causas/search", {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: "1 minute",
        keyGenerator: internalRateKey,
      },
    },
    schema: {
      body: freeSearchBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        404: { $ref: "error" },
        429: { $ref: "error" },
        502: { $ref: "error" },
      },
    },
    preHandler: async (request, reply) => {
      if (!hasInternalAccess(request)) {
        return reply.code(401).send({ error: "unauthorized", message: "Acceso interno no autorizado." });
      }
    },
  }, async (request, reply) => {
    const rawQuery = request.body.query.trim();
    try {
      if (request.body.kind === "rut") {
        const rut = normalizeRut(rawQuery);
        if (!isValidRut(rut)) {
          return reply.code(400).send({ error: "invalid_rut", message: "Ingresa un RUT chileno válido." });
        }
        return await searchPjud(rut, FREE_FILTERS);
      }

      const company = rawQuery.replace(/\s+/g, " ");
      if (company.length < 3 || !/[\p{L}\p{N}]/u.test(company)) {
        return reply.code(400).send({ error: "invalid_company", message: "Ingresa al menos 3 caracteres del nombre de la empresa." });
      }
      return await searchPjudCompany(company, FREE_FILTERS);
    } catch (error) {
      if (error instanceof PjudError && error.statusCode === 404) return emptyResult();
      return sendProviderError(error, reply);
    }
  });

  app.post<{ Body: { query: string } }>("/internal/v1/causas/suggestions", {
    config: {
      rateLimit: { max: 60, timeWindow: "1 minute", keyGenerator: internalRateKey },
    },
    schema: {
      body: suggestionsBodySchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        429: { $ref: "error" },
        502: { $ref: "error" },
      },
    },
    preHandler: async (request, reply) => {
      if (!hasInternalAccess(request)) {
        return reply.code(401).send({ error: "unauthorized", message: "Acceso interno no autorizado." });
      }
    },
  }, async (request, reply) => {
    const company = request.body.query.trim().replace(/\s+/g, " ");
    if (company.length < 3 || !/[\p{L}\p{N}]/u.test(company)) {
      return reply.code(400).send({ error: "invalid_company", message: "Ingresa al menos 3 caracteres del nombre de la empresa." });
    }
    try {
      return await searchPjudCompanySuggestions(company);
    } catch (error) {
      return sendProviderError(error, reply);
    }
  });

  app.get("/api/v1/causas/rut/:rut", {
    config: { rateLimit: { max: 120, timeWindow: "1 minute", keyGenerator: (request) => request.headers["x-api-key"] as string || request.ip } },
    schema: {
      params: rutParamsSchema,
      querystring: paidQuerySchema,
      headers: apiKeyHeadersSchema,
      response: {
        400: { $ref: "error" },
        401: { $ref: "error" },
        402: { $ref: "error" },
        404: { $ref: "error" },
        429: { $ref: "error" },
        502: { $ref: "error" },
      },
    },
  }, async (request: CausaRequest, reply) => {
    const rut = normalizeRut(request.params.rut);
    if (!isValidRut(rut)) {
      return reply.code(400).send({ error: "invalid_rut", message: "Ingresa un RUT chileno válido." });
    }

    const apiKey = request.headers["x-api-key"];
    if (typeof apiKey !== "string" || !apiKey) {
      return reply.code(401).send({ error: "missing_api_key", message: "Envía tu credencial en X-API-Key." });
    }

    const reservation = await reserveCredit(apiKey);
    if (!reservation) {
      return reply.code(402).send({ error: "invalid_key_or_balance", message: "La credencial no es válida o no tiene créditos." });
    }

    const startedAt = performance.now();
    try {
      const payload = await searchPjud(rut, request.query);
      await logApiRequest({ reservation, requestId: request.id, statusCode: 200, durationMs: Math.round(performance.now() - startedAt) });
      return payload;
    } catch (error) {
      await refundCredit(reservation);
      const statusCode = error instanceof PjudError ? error.statusCode : 502;
      await logApiRequest({ reservation, requestId: request.id, statusCode, durationMs: Math.round(performance.now() - startedAt) });
      return sendProviderError(error, reply);
    }
  });
}
