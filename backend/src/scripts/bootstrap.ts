import { randomBytes } from "node:crypto";
import { db } from "../db.js";
import { hashApiKey } from "../services/credits.js";

const organizationName = process.env.BOOTSTRAP_ORG_NAME ?? "Ghostinc Demo";
const credits = Number.parseInt(process.env.BOOTSTRAP_CREDITS ?? "100", 10);

if (!Number.isInteger(credits) || credits < 1) {
  throw new Error("BOOTSTRAP_CREDITS must be a positive integer.");
}

const apiKey = `pjud_live_${randomBytes(24).toString("base64url")}`;
const client = await db.connect();

try {
  await client.query("BEGIN");
  const organization = await client.query<{ id: string }>(
    "INSERT INTO organizations (name, credit_balance) VALUES ($1, $2) RETURNING id",
    [organizationName, credits],
  );
  const organizationId = organization.rows[0]!.id;
  await client.query(
    `INSERT INTO api_keys (organization_id, name, key_hash, prefix, last_four)
     VALUES ($1, 'Bootstrap', $2, $3, $4)`,
    [organizationId, hashApiKey(apiKey), "pjud_live_", apiKey.slice(-4)],
  );
  await client.query(
    `INSERT INTO credit_ledger (organization_id, delta, reason, metadata)
     VALUES ($1, $2, 'bootstrap', $3)`,
    [organizationId, credits, JSON.stringify({ organizationName })],
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
