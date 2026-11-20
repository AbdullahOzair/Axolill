import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy-Report-Only",
            value: [
              "default-src 'self'",
              "script-src 'self' https://app.cal.com https://cal.com https://static.cloudflareinsights.com",
              "style-src 'self'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self' https://api.cal.com https://cloudflareinsights.com",
              "frame-src https://www.google.com https://app.cal.com https://cal.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

// Makes Cloudflare bindings (DB, FILES) and .dev.vars secrets available to
// `next dev` through getCloudflareContext(). Without this, auth throws locally
// because D1 only exists at request time on Cloudflare.
initOpenNextCloudflareForDev();
