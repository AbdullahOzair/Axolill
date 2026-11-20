import { getAuth } from "@/lib/auth";
import { badRequest, notFound, requireAdmin } from "@/lib/api";
import { boundedBody, JSON_BODY_LIMIT, PRIVATE_CACHE, securityEvent, withApiErrors } from "@/lib/http-security";
import { limitEndpoint } from "@/lib/rate-limit";

const THROTTLED_ACTIONS = new Map([
  ["/api/auth/sign-in/email", "sign_in_email"],
  ["/api/auth/sign-in/social", "sign_in_social"],
  ["/api/auth/sign-up/email", "sign_up_email"],
  ["/api/auth/request-password-reset", "request_password_reset"],
  ["/api/auth/two-factor/verify-totp", "verify_totp"],
  ["/api/auth/two-factor/verify-backup-code", "verify_backup_code"],
]);

const MANAGE_MFA = new Set(["/api/auth/two-factor/enable", "/api/auth/two-factor/disable"]);

function authPath(request: Request) {
  try {
    return decodeURIComponent(new URL(request.url).pathname).replace(/\/+$/, "");
  } catch {
    return null;
  }
}

/**
 * better-auth catch-all handler.
 *
 * The auth instance is built per request (D1 is only available at request time),
 * so we call getAuth() inside the handler rather than at module scope.
 */
function privateResponse(response: Response) {
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", PRIVATE_CACHE);
  return result;
}

export const GET = withApiErrors("GET /api/auth/[...all]", async function GET(request: Request) {
  const path = authPath(request);
  if (!path || path.startsWith("/api/auth/two-factor/")) return notFound();
  const response = await getAuth().handler(request);
  const location = response.headers.get("location");
  if (path === "/api/auth/callback/google" && location) {
    const redirected = new URL(location, request.url);
    if (redirected.searchParams.has("error")) securityEvent("google_sign_in_rejected");
  }
  return privateResponse(response);
});

export const POST = withApiErrors("POST /api/auth/[...all]", async function POST(request: Request) {
  const path = authPath(request);
  if (!path) return notFound();
  const action = THROTTLED_ACTIONS.get(path);
  const admin = MANAGE_MFA.has(path) ? await requireAdmin(request) : null;
  if (admin instanceof Response) return admin;
  if (path.startsWith("/api/auth/two-factor/") && !admin && !action) return notFound();
  if (action) {
    const limited = await limitEndpoint(request, "authentication");
    if (limited) return limited;
  }

  let bytes: ArrayBuffer | Response;
  try {
    bytes = await boundedBody(request, JSON_BODY_LIMIT);
  } catch {
    return badRequest("Could not read authentication request");
  }
  if (bytes instanceof Response) return bytes;

  const response = await getAuth().handler(new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bytes.byteLength ? bytes : undefined,
  }));
  if (action && !response.ok && response.status < 500) {
    securityEvent("authentication_request_rejected", { action, status: response.status });
  }
  if (admin && response.ok) {
    securityEvent(path.endsWith("/disable") ? "admin_mfa_disabled" : "admin_mfa_enrollment_started", {
      actorId: admin.user.id,
    });
  }
  return privateResponse(response);
});
