import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

/**
 * Drizzle client bound to the D1 database (`DB` binding in wrangler.jsonc).
 * Call inside a request scope (Server Component, route handler, server action).
 */
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

/** The R2 bucket used for file uploads (`FILES` binding). */
export function getFilesBucket() {
  const { env } = getCloudflareContext();
  return env.FILES;
}

export { schema };
