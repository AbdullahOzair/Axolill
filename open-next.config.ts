import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Build with:  npm run cf:build
 * Preview:     npm run cf:preview
 * Deploy:      npm run cf:deploy
 *
 * NOTE: `npm run build` (no --turbopack) is used for production builds.
 * Turbopack is only enabled in `npm run dev` for fast local iteration.
 */
export default defineCloudflareConfig();
