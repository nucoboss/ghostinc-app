import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startPjudStub } from "./helpers/pjud-stub.js";
import { TEST_INTERNAL_TOKEN } from "./helpers/setup.js";

const stub = await startPjudStub();
process.env.PJUD_API_BASE_URL = stub.url;

const { buildApp } = await import("../src/app.js");
const { truncateAll } = await import("./helpers/db.js");

const app = await buildApp();

const VALID_RUT = "61502000-1";
const internalHeaders = { "x-internal-token": TEST_INTERNAL_TOKEN, "x-client-ip": "203.0.113.10" };

before(async () => {
  await truncateAll();
});

after(async () => {
  await app.close();
  stub.close();
});

function search(body: { kind: "rut" | "company"; query: string }, headers: Record<string, string> = internalHeaders) {
  return app.inject({ method: "POST", url: "/internal/v1/causas/search", headers, payload: body });
}

function suggestions(query: string, headers: Record<string, string> = internalHeaders) {
  return app.inject({
    method: "POST",
    url: "/internal/v1/causas/suggestions",
    headers,
    payload: { query },
  });
}

describe("POST /internal/v1/causas/search (búsqueda gratuita)", () => {
  it("rechaza llamadas sin token interno", async () => {
    const response = await search({ kind: "rut", query: VALID_RUT }, {});
    assert.equal(response.statusCode, 401);
    assert.equal(response.json().error, "unauthorized");
  });

  it("rechaza RUT inválido con 400", async () => {
    const response = await search({ kind: "rut", query: "12.345.678-9" });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_rut");
    assert.equal(stub.requests.length, 0);
  });

  it("impone estado, participación y límite fijos para RUT", async () => {
    const response = await search({ kind: "rut", query: VALID_RUT });
    assert.equal(response.statusCode, 200);

    const received = stub.requests.at(-1)!;
    assert.equal(received.path, `/api/v1/causas/rut/${VALID_RUT}`);
    assert.deepEqual(Object.fromEntries(received.query.entries()), {
      estado: "abiertas",
      participacion: "demandado",
      limit: "10",
    });
  });

  it("busca por nombre únicamente mediante el endpoint empresarial", async () => {
    const response = await search({ kind: "company", query: "  Empresa   Demo SPA " });
    assert.equal(response.statusCode, 200);

    const received = stub.requests.at(-1)!;
    assert.equal(received.path, "/api/v1/causas/empresa/nombre");
    assert.deepEqual(Object.fromEntries(received.query.entries()), {
      estado: "abiertas",
      participacion: "demandado",
      limit: "10",
      nombre: "Empresa Demo SPA",
    });
  });

  it("rechaza nombres no significativos antes de llamar al proveedor", async () => {
    const baseline = stub.requests.length;
    const response = await search({ kind: "company", query: "%%%" });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "invalid_company");
    assert.equal(stub.requests.length, baseline);
  });

  it("convierte un 404 del proveedor en resultado vacío", async () => {
    stub.setMode("not-found");
    const response = await search({ kind: "rut", query: VALID_RUT });
    assert.equal(response.statusCode, 200);
    assert.equal(response.json().data.summary.total, 0);
    assert.deepEqual(response.json().data.causas, []);
  });

  it("devuelve 502 cuando PJUD falla", async () => {
    stub.setMode("server-error");
    const response = await search({ kind: "rut", query: VALID_RUT });
    assert.equal(response.statusCode, 502);
    assert.equal(response.json().error, "upstream_error");
  });

  it("propaga y valida el payload en una consulta exitosa", async () => {
    stub.setMode("ok");
    const response = await search({ kind: "rut", query: VALID_RUT });
    assert.equal(response.statusCode, 200);
    const payload = response.json();
    assert.equal(payload.data.causas[0].rol, "O-123-2024");
    assert.equal(payload.data.summary.total, 1);
  });

  it("sugiere únicamente empresas mediante el endpoint dedicado", async () => {
    stub.setMode("ok");
    const response = await suggestions(" Empresa   Demo ");
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json().data[0], {
      nombre: "EMPRESA DEMO SPA",
      rut: "76123456-7",
      causas: 12,
    });
    const received = stub.requests.at(-1)!;
    assert.equal(received.path, "/api/v1/causas/empresa/sugerencias");
    assert.deepEqual(Object.fromEntries(received.query.entries()), {
      nombre: "Empresa Demo",
      limit: "8",
    });
  });

  it("rechaza sugerencias inválidas sin llamar al proveedor", async () => {
    const baseline = stub.requests.length;
    const response = await suggestions("%%%");
    assert.equal(response.statusCode, 400);
    assert.equal(stub.requests.length, baseline);
  });
});
