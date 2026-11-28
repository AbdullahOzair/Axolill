import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { PRIVATE_CACHE, securityEvent } from "@/lib/http-security";

export async function limitEndpoint(
  request: Request,
  action: "authentication" | "contact" | "intake" | "meeting_request" | "inquiry" | "inquiry_events" | "quote_view" | "quote_response" | "quote_pdf",
  actorId?: string
) {
  const { env } = getCloudflareContext();
  const limiter = action === "authentication" || action === "quote_response" ? env.AUTH_RATE_LIMITER :
    action === "inquiry_events" || action === "quote_view" || action === "quote_pdf" ? env.INQUIRY_ANALYTICS_RATE_LIMITER : env.CONTACT_RATE_LIMITER;
  // Cloudflare sets this at ingress. A shared fallback also supports local Workerd.
  const identity = actorId ?? request.headers.get("cf-connecting-ip") ?? "unknown-client";
  const key = `${action}:${identity}`;

  try {
    const { success } = await limiter.limit({ key });
    if (success) return;

    securityEvent("rate_limit_exceeded", { action });
    return Response.json(
      { error: "Too many requests. Try again in a minute." },
      { status: 429, headers: { "Retry-After": "60", "Cache-Control": PRIVATE_CACHE } }
    );
  } catch {
    securityEvent("rate_limiter_unavailable", { action });
    return Response.json(
      { error: "Temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": PRIVATE_CACHE } }
    );
  }
}
