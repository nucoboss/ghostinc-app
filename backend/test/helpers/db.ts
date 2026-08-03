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
  "memberships",
  "users",
  "organizations",
];

export async function truncateAll() {
  const db = await getDb();
  await db.query(`TRUNCATE ${TABLES.join(", ")} RESTART IDENTITY CASCADE`);
}

export async function seedOrganization(credits = 10) {
  const db = await getDb();
  const hashApiKey = await getHashApiKey();
  const organization = await db.query<{ id: string }>(
    "INSERT INTO organizations (name, credit_balance) VALUES ($1, $2) RETURNING id",
    ["Org de prueba", credits],
  );
  const apiKey = newTestApiKey();
  await db.query(
    "INSERT INTO api_keys (organization_id, name, key_hash, prefix, last_four) VALUES ($1, 'clave-test', $2, 'pjud', $3)",
    [organization.rows[0]!.id, hashApiKey(apiKey), apiKey.slice(-4)],
  );
  return { organizationId: organization.rows[0]!.id, apiKey };
}

export async function creditBalance(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ credit_balance: number }>(
    "SELECT credit_balance FROM organizations WHERE id = $1",
    [organizationId],
  );
  return result.rows[0]!.credit_balance;
}

export async function ledgerDelta(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ total: number }>(
    "SELECT COALESCE(SUM(delta), 0)::int AS total FROM credit_ledger WHERE organization_id = $1",
    [organizationId],
  );
  return result.rows[0]!.total;
}

export async function apiRequestRows(organizationId: string) {
  const db = await getDb();
  const result = await db.query<{ status_code: number; credits_charged: number }>(
    "SELECT status_code, credits_charged FROM api_requests WHERE organization_id = $1",
    [organizationId],
  );
  return result.rows;
}
