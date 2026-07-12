import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Build with:  npx opennextjs-cloudflare build
 * Preview:     npx opennextjs-cloudflare preview
 * Deploy:      npx opennextjs-cloudflare deploy
 *
 * Incremental cache / queue are left at their defaults. See
 * https://opennext.js.org/cloudflare/caching to add R2/KV-backed caching.
 */
export default defineCloudflareConfig();
