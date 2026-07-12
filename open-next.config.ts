import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Build with:  npm run cf:build
 * Preview:     npm run cf:preview
 * Deploy:      npm run cf:deploy
 *
 * IMPORTANT: We use `next build` (no --turbopack) here because
 * Turbopack's chunk format is incompatible with the Cloudflare Worker
 * runtime (causes "handler is not a function" + _app.js chunk errors).
 * Turbopack is still used for `npm run dev` for fast local iteration.
 */
export default defineCloudflareConfig({
  buildCommand: "npx next build",
});
