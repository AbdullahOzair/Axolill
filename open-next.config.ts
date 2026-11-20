import { defineCloudflareConfig } from "@opennextjs/cloudflare";

/**
 * Build with:  npm run cf:build
 * Preview:     npm run cf:preview
 * Deploy:      npm run cf:deploy
 *
 * The production build uses Webpack. Local development uses Turbopack.
 */
export default defineCloudflareConfig();
