import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startPjudStub } from "./helpers/pjud-stub.js";

const stub = await startPjudStub();
process.env.PJUD_API_BASE_URL = stub.url;

const { buildApp } = await import("../src/app.js");
const { apiRequestRows, creditBalance, ledgerDelta, seedUser, truncateAll } = await import("./helpers/db.js");

const app = await buildApp();

const VALID_RUT = "61502000-1";

before(async () => {
  await truncateAll();
});

after(async () => {
  await app.close();
  stub.close();
});

describe("GET /api/v1/causas/rut/:rut (API comercial)", () => {
  it("responde 401 sin X-API-Key", async () => {
    const response = await app.inject({ method: "GET", url: `/api/v1/causas/rut/${VALID_RUT}` });
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "missing_api_key");
  });

  it("responde 402 con clave desconocida", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": "pjud_test_key_que_no_existe" },
    });
    assert.equal(response.statusCode, 402);
    assert.equal(response.json().error, "invalid_key_or_balance");
  });

  it("responde 402 con clave válida y saldo cero", async () => {
    const { apiKey } = await seedUser(0);
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": apiKey },
    });
    assert.equal(response.statusCode, 402);
    assert.equal(response.json().error, "invalid_key_or_balance");
  });

  it("consume exactamente un crédito en una consulta exitosa", async () => {
    const { userId, apiKey } = await seedUser(3);
    stub.setMode("ok");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": apiKey },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.causas[0].rol, "O-123-2024");
    assert.equal(await creditBalance(userId), 2);
    assert.equal(await ledgerDelta(userId), -1);
    const rows = await apiRequestRows(userId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.status_code, 200);
    assert.equal(rows[0]!.credits_charged, 1);
  });

  it("devuelve 502 y compensa el crédito cuando PJUD falla", async () => {
    const { userId, apiKey } = await seedUser(3);
    stub.setMode("server-error");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": apiKey },
    });

    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error, "upstream_error");
    assert.equal(await creditBalance(userId), 3);
    assert.equal(await ledgerDelta(userId), 0);
    const rows = await apiRequestRows(userId);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.status_code, 502);
    assert.equal(rows[0]!.credits_charged, 0);
  });

  it("devuelve 404 y compensa el crédito cuando PJUD no encuentra causas", async () => {
    const { userId, apiKey } = await seedUser(3);
    stub.setMode("not-found");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": apiKey },
    });

    assert.equal(response.statusCode, 404);
    assert.equal(response.json().error, "upstream_error");
    assert.equal(await creditBalance(userId), 3);
    assert.equal(await ledgerDelta(userId), 0);
  });

  it("rechaza con 400 y sin consumir créditos los parámetros fuera de contrato", async () => {
    const { userId, apiKey } = await seedUser(3);
    stub.setMode("ok");
    const baseline = stub.requests.length;

    const invalidCases = [
      `limit=0`,
      `limit=501`,
      `limit=abc`,
      `offset=-1`,
      `participacion=otro`,
      `competencia=administrativo`,
      `tipo_causa=X`,
      `include_abogados=si`,
      `q=${"x".repeat(201)}`,
      `fecha_desde=01-01-2025`,
      `fecha_hasta=2025/01/01`,
      `parametro_evil=x`,
    ];

    for (const query of invalidCases) {
      const response = await app.inject({
        method: "GET",
        url: `/api/v1/causas/rut/${VALID_RUT}?${query}`,
        headers: { "x-api-key": apiKey },
      });
      assert.equal(response.statusCode, 400, `caso inválido aceptado: ${query}`);
      assert.equal(response.json().error, "invalid_request");
      assert.ok(Array.isArray(response.json().details));
    }

    assert.equal(await creditBalance(userId), 3);
    assert.equal(await ledgerDelta(userId), 0);
    assert.equal(stub.requests.length, baseline, "no debe llamarse a PJUD con parámetros inválidos");
  });

  it("admite parámetros de contrato y los reenvía a PJUD", async () => {
    const { apiKey } = await seedUser(1);
    stub.setMode("ok");

    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}?limit=5&offset=10&participacion=demandante&competencia=laboral&estado=cerradas&tipo_causa=O&include_abogados=true&q=algo&fecha_desde=2025-01-01&fecha_hasta=2025-12-31&tribunal_id=T-001`,
      headers: { "x-api-key": apiKey },
    });

    assert.equal(response.statusCode, 200);
    const received = stub.requests.at(-1)!;
    assert.deepEqual(Object.fromEntries(received.query.entries()), {
      limit: "5",
      offset: "10",
      participacion: "demandante",
      competencia: "laboral",
      estado: "cerradas",
      tipo_causa: "O",
      include_abogados: "true",
      q: "algo",
      fecha_desde: "2025-01-01",
      fecha_hasta: "2025-12-31",
      tribunal_id: "T-001",
    });
  });

  it("rechaza X-API-Key de longitud no válida con 400", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/causas/rut/${VALID_RUT}`,
      headers: { "x-api-key": "corta" },
    });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_request");
  });
});
