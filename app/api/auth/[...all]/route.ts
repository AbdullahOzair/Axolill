import { getAuth } from "@/lib/auth";

/**
 * better-auth catch-all handler.
 *
 * The auth instance is built per request (D1 is only available at request time),
 * so we call getAuth() inside the handler rather than at module scope.
 */
export async function GET(request: Request) {
  return getAuth().handler(request);
}

export async function POST(request: Request) {
  return getAuth().handler(request);
}
