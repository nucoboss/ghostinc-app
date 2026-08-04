import { randomBytes } from "node:crypto";
import { db } from "../db.js";
import { hashApiKey } from "../services/credits.js";

const userEmail = process.env.BOOTSTRAP_USER_EMAIL ?? "demo@ghostinc.local";
const credits = Number.parseInt(process.env.BOOTSTRAP_CREDITS ?? "100", 10);

if (!Number.isInteger(credits) || credits < 1) {
  throw new Error("BOOTSTRAP_CREDITS must be a positive integer.");
}

const apiKey = `pjud_live_${randomBytes(24).toString("base64url")}`;
const client = await db.connect();

try {
  await client.query("BEGIN");
  const user = await client.query<{ id: string }>(
    `INSERT INTO users (email, credit_balance)
     VALUES ($1, $2)
     ON CONFLICT (lower(email)) DO UPDATE SET credit_balance = users.credit_balance + $2
     RETURNING id`,
    [userEmail, credits],
  );
  const userId = user.rows[0]!.id;
  await client.query(
    `INSERT INTO api_keys (user_id, name, key_hash, prefix, last_four)
     VALUES ($1, 'Bootstrap', $2, $3, $4)`,
    [userId, hashApiKey(apiKey), "pjud_live_", apiKey.slice(-4)],
  );
  await client.query(
    `INSERT INTO credit_ledger (user_id, delta, reason, metadata)
     VALUES ($1, $2, 'bootstrap', $3)`,
    [userId, credits, JSON.stringify({ userEmail })],
  );
  await client.query("COMMIT");

  console.log("Bootstrap complete. This API key is shown only once:");
  console.log(apiKey);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await db.end();
}
