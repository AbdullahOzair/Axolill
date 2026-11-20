export const PRIVATE_CACHE = "private, no-store";
export const JSON_BODY_LIMIT = 64 * 1024;

export function sameOrigin(request: Request, canonicalUrl: string) {
  const origin = request.headers.get("origin");
  return (
    origin !== null &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    origin === new URL(canonicalUrl).origin
  );
}

function payloadTooLarge() {
  return Response.json(
    { error: "Request body exceeds the size limit" },
    { status: 413, headers: { "Cache-Control": PRIVATE_CACHE } }
  );
}

/** Check the advertised size and enforce the same limit on streamed bodies. */
export async function boundedBody(
  request: Request,
  limit: number
): Promise<ArrayBuffer | Response> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && Number(declaredLength) > limit) {
    return payloadTooLarge();
  }
  if (!request.body) return new ArrayBuffer(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => {});
        return payloadTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 1) {
    const [chunk] = chunks;
    if (
      chunk.buffer instanceof ArrayBuffer &&
      chunk.byteOffset === 0 &&
      chunk.byteLength === chunk.buffer.byteLength
    ) return chunk.buffer;
  }

  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

export function securityEvent(
  event: string,
  details: { action?: string; actorId?: string; status?: number } = {}
) {
  console.info(JSON.stringify({ component: "security", event, ...details }));
}

export function withApiErrors<Args extends unknown[]>(
  action: string,
  handle: (...args: Args) => Promise<Response>
) {
  return async (...args: Args) => {
    try {
      return await handle(...args);
    } catch {
      // ORM and provider errors can include parameter values or credentials.
      securityEvent("api_request_failed", { action });
      return Response.json(
        { error: "The request could not be completed" },
        { status: 500, headers: { "Cache-Control": PRIVATE_CACHE } }
      );
    }
  };
}
