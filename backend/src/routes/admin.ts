import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { hasInternalAccess } from "../lib/internal-auth.js";
import { requireAdminActor, sessionTokenFromRequest } from "../lib/authorize.js";
import { setUserBlocked, setUserRole } from "../services/auth-store.js";
import { issueAuthToken } from "../services/auth-tokens.js";
import { config } from "../config.js";
import { sendAuthEmail } from "../services/email.js";

const userIdParamsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 36, maxLength: 36 },
  },
} as const;

const adminActionBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
  },
} as const;

const adminInviteBodySchema = {
  type: "object",
  additionalProperties: false,
  required: ["token", "email"],
  properties: {
    token: { type: "string", minLength: 1, maxLength: 128 },
    email: { type: "string", minLength: 3, maxLength: 254, pattern: "^[^\\s@]+@[^\\s@]+$" },
  },
} as const;

export async function adminRoutes(app: FastifyInstance) {
  app.addHook("onRequest", async (request, reply) => {
    if (!hasInternalAccess(request)) {
      return reply.code(401).send({ error: "unauthorized", message: "Acceso interno no autorizado." });
    }
  });

  app.get("/users", async (request) => {
    await requireAdminActor(sessionTokenFromRequest(request));
    const result = await db.query<{
      id: string;
      email: string;
      global_role: string;
      blocked_at: Date | null;
      email_verified_at: Date | null;
      last_login_at: Date | null;
      created_at: Date;
      active_sessions: number;
    }>(
      `SELECT u.id, u.email, u.global_role, u.blocked_at, u.email_verified_at,
              u.last_login_at, u.created_at,
              (SELECT count(*)::int FROM auth_sessions s
               WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS active_sessions
       FROM users u
       ORDER BY u.created_at DESC`,
    );
    return {
      data: {
        total: result.rowCount,
        users: result.rows.map((row) => ({
          id: row.id,
          email: row.email,
          global_role: row.global_role,
          blocked_at: row.blocked_at,
          email_verified_at: row.email_verified_at,
          last_login_at: row.last_login_at,
          created_at: row.created_at,
          active_sessions: row.active_sessions,
        })),
      },
    };
  });

  app.post("/users/invite", {
    schema: {
      body: adminInviteBodySchema,
      response: {
        403: { $ref: "error" },
        409: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string; email: string };
    const actor = await requireAdminActor(body.token);
    const issued = await issueAuthToken(body.email, "registration", actor.id);
    if (!issued) {
      return reply.code(409).send({
        error: "account_already_active",
        message: "La cuenta ya está activa, bloqueada o no puede recibir una invitación.",
      });
    }
    const link = new URL("/crear-contrasena", config.appBaseUrl);
    link.hash = new URLSearchParams({ token: issued.token, mode: "registration" }).toString();
    await sendAuthEmail({
      to: issued.email,
      link: link.toString(),
      expiredAt: issued.expiresAt,
      kind: "registration",
    });
    return { ok: true };
  });

  app.post<{ Params: { id: string } }>("/users/:id/block", {
    schema: {
      params: userIdParamsSchema,
      body: adminActionBodySchema,
      response: {
        400: { $ref: "error" },
        403: { $ref: "error" },
        404: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const actor = await requireAdminActor((request.body as { token: string }).token);
    if (actor.id === request.params.id) {
      return reply.code(400).send({ error: "invalid_action", message: "No puedes bloquear tu propia cuenta." });
    }
    try {
      await setUserBlocked(request.params.id, true, actor.id);
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return reply.code(404).send({ error: "not_found", message: "Usuario no encontrado." });
      }
      if (error instanceof Error && ["INVALID_SELF_ACTION", "LAST_ACTIVE_ADMIN"].includes(error.message)) {
        return reply.code(400).send({ error: "invalid_action", message: "La acción dejaría la administración en un estado no válido." });
      }
      if (error instanceof Error && error.message === "ADMIN_ACTOR_INVALID") {
        return reply.code(403).send({ error: "forbidden", message: "La sesión administrativa ya no es válida." });
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>("/users/:id/unblock", {
    schema: {
      params: userIdParamsSchema,
      body: adminActionBodySchema,
      response: {
        400: { $ref: "error" },
        403: { $ref: "error" },
        404: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const actor = await requireAdminActor((request.body as { token: string }).token);
    if (actor.id === request.params.id) {
      return reply.code(400).send({ error: "invalid_action", message: "No puedes desbloquear tu propia cuenta." });
    }
    try {
      await setUserBlocked(request.params.id, false, actor.id);
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return reply.code(404).send({ error: "not_found", message: "Usuario no encontrado." });
      }
      if (error instanceof Error && ["INVALID_SELF_ACTION", "LAST_ACTIVE_ADMIN"].includes(error.message)) {
        return reply.code(400).send({ error: "invalid_action", message: "La acción dejaría la administración en un estado no válido." });
      }
      if (error instanceof Error && error.message === "ADMIN_ACTOR_INVALID") {
        return reply.code(403).send({ error: "forbidden", message: "La sesión administrativa ya no es válida." });
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>("/users/:id/role", {
    schema: {
      params: userIdParamsSchema,
      body: {
        ...adminActionBodySchema,
        required: ["token", "role"],
        properties: {
          token: { type: "string", minLength: 1, maxLength: 128 },
          role: { type: "string", enum: ["user", "admin"] },
        },
      },
      response: {
        400: { $ref: "error" },
        403: { $ref: "error" },
        404: { $ref: "error" },
      },
    },
  }, async (request, reply) => {
    const body = request.body as { token: string; role: "user" | "admin" };
    const actor = await requireAdminActor(body.token);
    if (actor.id === request.params.id) {
      return reply.code(400).send({ error: "invalid_action", message: "No puedes cambiar tu propio rol." });
    }
    try {
      await setUserRole(request.params.id, body.role, actor.id);
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.message === "USER_NOT_FOUND") {
        return reply.code(404).send({ error: "not_found", message: "Usuario no encontrado." });
      }
      if (error instanceof Error && ["INVALID_SELF_ACTION", "LAST_ACTIVE_ADMIN"].includes(error.message)) {
        return reply.code(400).send({ error: "invalid_action", message: "La acción dejaría la administración en un estado no válido." });
      }
      if (error instanceof Error && error.message === "ADMIN_ACTOR_INVALID") {
        return reply.code(403).send({ error: "forbidden", message: "La sesión administrativa ya no es válida." });
      }
      throw error;
    }
  });

  app.get("/overview", async (request) => {
    await requireAdminActor(sessionTokenFromRequest(request));
    const [metrics, activity, accounts] = await Promise.all([
      db.query<{
        users: number;
        active_keys: number;
        available_credits: number;
        requests_24h: number;
        errors_24h: number;
        credits_24h: number;
      }>(
        `SELECT
          (SELECT count(*)::int FROM users) AS users,
          (SELECT count(*)::int FROM api_keys WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS active_keys,
          (SELECT coalesce(sum(credit_balance), 0)::int FROM users) AS available_credits,
          (SELECT count(*)::int FROM api_requests WHERE created_at >= now() - interval '24 hours') AS requests_24h,
          (SELECT count(*)::int FROM api_requests WHERE created_at >= now() - interval '24 hours' AND status_code >= 400) AS errors_24h,
          (SELECT coalesce(sum(credits_charged), 0)::int FROM api_requests WHERE created_at >= now() - interval '24 hours') AS credits_24h`,
      ),
      db.query<{
        request_id: string;
        account: string;
        key_name: string | null;
        status_code: number;
        duration_ms: number;
        credits_charged: number;
        created_at: string;
      }>(
        `SELECT r.request_id, u.email AS account, k.name AS key_name, r.status_code,
                r.duration_ms, r.credits_charged, r.created_at
         FROM api_requests r
         JOIN users u ON u.id = r.user_id
         LEFT JOIN api_keys k ON k.id = r.api_key_id
         ORDER BY r.created_at DESC
         LIMIT 20`,
      ),
      db.query<{
        id: string;
        email: string;
        credit_balance: number;
        api_keys: number;
        requests_30d: number;
        created_at: string;
      }>(
        `SELECT u.id, u.email, u.credit_balance, u.created_at,
                count(DISTINCT k.id)::int AS api_keys,
                (count(DISTINCT r.id) FILTER (WHERE r.created_at >= now() - interval '30 days'))::int AS requests_30d
         FROM users u
         LEFT JOIN api_keys k ON k.user_id = u.id AND k.revoked_at IS NULL
         LEFT JOIN api_requests r ON r.user_id = u.id
         GROUP BY u.id
         ORDER BY u.created_at DESC
         LIMIT 100`,
      ),
    ]);

    return {
      data: {
        metrics: metrics.rows[0],
        activity: activity.rows,
        accounts: accounts.rows,
      },
    };
  });
}
