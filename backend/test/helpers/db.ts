import type { Pool } from "pg";
import { newTestApiKey } from "./setup.js";

async function getDb(): Promise<Pool> {
  const { db } = await import("../../src/db.js");
  return db;
}

async function getHashApiKey(): Promise<(apiKey: string) => string> {
  const { hashApiKey } = await import("../../src/services/credits.js");
  return hashApiKey;
}

const TABLES = [
  "auth_events",
  "recovery_codes",
  "totp_credentials",
  "auth_sessions",
  "auth_tokens",
  "api_requests",
  "credit_ledger",
  "api_keys",
  "billing_events",
  "users",
];

export async function truncateAll() {
  const db = await getDb();
  await db.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

let seedCounter = 0;

export async function seedUser(credits = 10) {
  const db = await getDb();
  const hashApiKey = await getHashApiKey();
  const email = `usuario-${++seedCounter}-${Date.now()}@example.test`;
  const user = await db.query<{ id: string }>(
    "INSERT INTO users (email, credit_balance) VALUES ($1, $2) RETURNING id",
    [email, credits],
  );
  const apiKey = newTestApiKey();
  await db.query(
    "INSERT INTO api_keys (user_id, name, key_hash, prefix, last_four) VALUES ($1, 'clave-test', $2, 'pjud', $3)",
    [user.rows[0]!.id, hashApiKey(apiKey), apiKey.slice(-4)],
  );
  return { userId: user.rows[0]!.id, apiKey };
}

export async function creditBalance(userId: string) {
  const db = await getDb();
  const result = await db.query<{ credit_balance: number }>(
    "SELECT credit_balance FROM users WHERE id = $1",
    [userId],
  );
  return result.rows[0]!.credit_balance;
}

export async function ledgerDelta(userId: string) {
  const db = await getDb();
  const result = await db.query<{ total: number }>(
    "SELECT COALESCE(SUM(delta), 0)::int AS total FROM credit_ledger WHERE user_id = $1",
    [userId],
  );
  return result.rows[0]!.total;
}

export async function apiRequestRows(userId: string) {
  const db = await getDb();
  const result = await db.query<{ status_code: number; credits_charged: number }>(
    "SELECT status_code, credits_charged FROM api_requests WHERE user_id = $1",
    [userId],
  );
  return result.rows;
}
