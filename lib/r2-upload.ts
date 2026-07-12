import "server-only";

import { badRequest, filesBucket } from "@/lib/api";

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

/** Sanitise a filename before it lands in an R2 object key. */
export function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

/**
 * Upload a browser File to R2. Buffers to an ArrayBuffer because workerd
 * requires a body of known length.
 */
export async function uploadFileToR2(
  file: File,
  key: string,
  customMetadata?: Record<string, string>
): Promise<Response | { contentType: string; sizeBytes: number }> {
  if (file.size === 0) return badRequest("File is empty");
  if (file.size > MAX_UPLOAD_BYTES) {
    return badRequest(
      `File "${file.name}" exceeds the ${MAX_UPLOAD_BYTES / 1024 / 1024}MB limit`
    );
  }

  const contentType = file.type || "application/octet-stream";

  try {
    const bytes = await file.arrayBuffer();
    await filesBucket().put(key, bytes, {
      httpMetadata: { contentType },
      customMetadata,
    });
  } catch (error) {
    console.error("R2 upload failed", error);
    return badRequest("Upload failed");
  }

  return { contentType, sizeBytes: file.size };
}
