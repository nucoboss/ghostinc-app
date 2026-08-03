import { randomBytes } from "node:crypto";

const dbUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "Define TEST_DATABASE_URL (o DATABASE_URL) apuntando a una base de pruebas antes de ejecutar tests. Ej: postgresql://ghostinc:ghostinc_test@127.0.0.1:55432/ghostinc_test",
  );
}

const dbName = new URL(dbUrl).pathname.split("/").filter(Boolean).at(-1) ?? "";
if (!dbName.toLowerCase().includes("test")) {
  throw new Error(`Rechazada base de pruebas por nombre "${dbName}": el nombre debe contener "test".`);
}

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = dbUrl;
process.env.API_KEY_PEPPER ??= "test-only-pepper-with-at-least-32-chars!!";
process.env.INTERNAL_SERVICE_TOKEN ??= "test-internal-token-with-at-least-32-chars!!";

export const TEST_INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN;

export function newTestApiKey() {
  return `pjud_test_${randomBytes(24).toString("base64url")}`;
}
