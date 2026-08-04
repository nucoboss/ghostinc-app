import { createHmac } from "node:crypto";
import { config } from "../config.js";
import { db } from "../db.js";

export type CreditReservation = {
  apiKeyId: string;
  userId: string;
  ledgerId: string;
};

const DEADLOCK_SQLSTATE = "40P01";

async function withDeadlockRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts || (error as { code?: string } | null)?.code !== DEADLOCK_SQLSTATE) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.random() * 30));
    }
  }
}

export function hashApiKey(apiKey: string) {
  return createHmac("sha256", config.apiKeyPepper).update(apiKey).digest("hex");
}

export function reserveCredit(apiKey: string): Promise<CreditReservation | null> {
  return withDeadlockRetry(async () => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        api_key_id: string;
        user_id: string;
        credit_balance: number;
      }>(
        `SELECT k.id AS api_key_id, u.id AS user_id, u.credit_balance
         FROM api_keys k
         JOIN users u ON u.id = k.user_id
         WHERE k.key_hash = $1
           AND k.revoked_at IS NULL
           AND (k.expires_at IS NULL OR k.expires_at > now())
         FOR UPDATE OF k, u`,
        [hashApiKey(apiKey)],
      );

      const credential = result.rows[0];
      if (!credential || credential.credit_balance < 1) {
        await client.query("ROLLBACK");
        return null;
      }

      await client.query("UPDATE users SET credit_balance = credit_balance - 1, updated_at = now() WHERE id = $1", [credential.user_id]);
      const ledger = await client.query<{ id: string }>(
        `INSERT INTO credit_ledger (user_id, delta, reason)
         VALUES ($1, -1, 'api_request') RETURNING id`,
        [credential.user_id],
      );
      await client.query("UPDATE api_keys SET last_used_at = now() WHERE id = $1", [credential.api_key_id]);
      await client.query("COMMIT");

      return {
        apiKeyId: credential.api_key_id,
        userId: credential.user_id,
        ledgerId: ledger.rows[0]!.id,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function refundCredit(reservation: CreditReservation) {
  return withDeadlockRetry(async () => {
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE users SET credit_balance = credit_balance + 1, updated_at = now() WHERE id = $1", [reservation.userId]);
      await client.query(
        `INSERT INTO credit_ledger (user_id, delta, reason, reference_id)
         VALUES ($1, 1, 'api_request_refund', $2)`,
        [reservation.userId, reservation.ledgerId],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
}

export function logApiRequest(input: {
  reservation: CreditReservation;
  requestId: string;
  statusCode: number;
  durationMs: number;
}) {
  return withDeadlockRetry(async () => {
    await db.query(
      `INSERT INTO api_requests (user_id, api_key_id, request_id, endpoint, status_code, duration_ms, credits_charged)
       VALUES ($1, $2, $3, '/api/v1/causas/rut/:rut', $4, $5, $6)`,
      [
        input.reservation.userId,
        input.reservation.apiKeyId,
        input.requestId,
        input.statusCode,
        input.durationMs,
        input.statusCode < 400 ? 1 : 0,
      ],
    );
  });
}
