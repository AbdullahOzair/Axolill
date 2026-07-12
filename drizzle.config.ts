import { defineConfig } from "drizzle-kit";

/**
 * Cloudflare D1 is SQLite. `drizzle-kit generate` only needs the dialect to
 * emit migration SQL — apply it with:
 *   npx wrangler d1 migrations apply DB --local
 *   npx wrangler d1 migrations apply DB --remote
 */
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
