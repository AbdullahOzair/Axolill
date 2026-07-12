import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

// Makes Cloudflare bindings (DB, FILES) and .dev.vars secrets available to
// `next dev` through getCloudflareContext(). Without this, auth throws locally
// because D1 only exists at request time on Cloudflare.
initOpenNextCloudflareForDev();
