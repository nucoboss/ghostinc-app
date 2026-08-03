import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": here("./src"),
      "server-only": here("./test/stubs/server-only.ts"),
      "next/link": here("./test/stubs/next-link.tsx"),
      "next/navigation": here("./test/stubs/next-navigation.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
});
