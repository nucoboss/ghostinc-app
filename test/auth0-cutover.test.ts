import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("corte de Auth0", () => {
  it("no conserva el SDK ni clientes y rutas runtime", () => {
    for (const path of [
      "src/lib/auth0.ts",
      "src/lib/auth0-management.ts",
      "src/lib/my-account.ts",
      "src/app/api/account/authentication-methods/route.ts",
      "src/app/api/account/authentication-methods/[id]/route.ts",
      "src/app/api/account/password-reset/route.ts",
    ]) {
      expect(existsSync(resolve(root, path)), path).toBe(false);
    }
  });

  it("no declara dependencias ni variables Auth0 ejecutables", () => {
    for (const path of [
      "package.json",
      "package-lock.json",
      ".env.example",
      ".env.production.example",
      "compose.yaml",
      "compose.production.yaml",
    ]) {
      const content = readFileSync(resolve(root, path), "utf8");
      expect(content, path).not.toMatch(/@auth0|AUTH0_/i);
    }
  });
});
