import "./helpers/setup.js";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { startPjudStub } from "./helpers/pjud-stub.js";

const stub = await startPjudStub();
process.env.PJUD_API_BASE_URL = stub.url;

const { buildApp } = await import("../src/app.js");
const { apiRequestRows, creditBalance, ledgerDelta, seedOrganization, truncateAll } = await import("./helpers/db.js");

const app = await buildApp();

const VALID_RUT = "61502000-1";

before(async () => {
  await truncateAll();
});

after(async () => {
  await app.close();
  stub.close();
});

describe("Concurrencia de saldo", () => {
  it("nunca gasta más saldo del disponible ante solicitudes simultáneas", async () => {
    const { organizationId, apiKey } = await seedOrganization(5);
    stub.setMode("ok");

    const requests = Array.from({ length: 20 }, () =>
      app.inject({
        method: "GET",
        url: `/api/v1/causas/rut/${VALID_RUT}`,
        headers: { "x-api-key": apiKey },
      }),
    );

    const responses = await Promise.all(requests);
    const statusCodes = responses.map((response) => response.statusCode);

    assert.equal(statusCodes.filter((code) => code === 200).length, 5);
    assert.equal(statusCodes.filter((code) => code === 402).length, 15);
    assert.equal(await creditBalance(organizationId), 0);
    assert.equal(await ledgerDelta(organizationId), -5);

    const rows = await apiRequestRows(organizationId);
    assert.equal(rows.length, 5);
    assert.ok(rows.every((row) => row.status_code === 200 && row.credits_charged === 1));
  });
});
