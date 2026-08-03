import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startPjudStub } from "./helpers/pjud-stub.js";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";

const stub = await startPjudStub();
process.env.PJUD_API_BASE_URL = stub.url;

const { buildApp } = await import("../src/app.js");
const { seedOrganization, truncateAll } = await import("./helpers/db.js");

const app = await buildApp();

const VALID_RUT = "61502000-1";

let dbEnded = false;

before(async () => {
  await truncateAll();
});

after(async () => {
  if (!dbEnded) await app.close();
  stub.close();
});

describe("Normalización de errores", () => {
  it("404 con forma estable y sin detalles internos", async () => {
    const response = await app.inject({ method: "GET", url: "/ruta/que/no/existe" });
    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { error: "not_found", message: "Recurso no encontrado." });
  });

  it("429 con forma estable al exceder el límite de la ruta gratuita", async () => {
    stub.setMode("ok");
    let last;
    for (let i = 0; i < 21; i++) {
      last = await app.inject({
        method: "POST",
        url: "/internal/v1/causas/search",
        headers: { "x-internal-token": TEST_INTERNAL_TOKEN, "x-client-ip": "203.0.113.20" },
        payload: { kind: "rut", query: VALID_RUT },
      });
    }
    assert.equal(last!.statusCode, 429);
    assert.deepEqual(last!.json(), { error: "rate_limited", message: "Demasiadas solicitudes. Intenta nuevamente en un minuto." });
  });

  it("5xx sanitizado: sin stack, SQL ni URLs internas", async () => {
    const { apiKey } = await seedOrganization(1);
    const { db } = await import("../src/db.js");
    await db.end();
    dbEnded = true;

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": apiKey },
    });

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.json(), { error: "internal_error", message: "Error interno del servidor." });
    const body = response.body;
    assert.ok(!body.includes("at "), "el cuerpo no debe incluir stack");
    assert.ok(!body.includes("select"), "el cuerpo no debe incluir SQL");
    assert.ok(!body.includes("localhost"), "el cuerpo no debe incluir URLs internas");
  });
});
