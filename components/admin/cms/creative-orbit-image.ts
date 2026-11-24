import { CMS_IMAGE_MAX_BYTES, matchesCmsImageType } from "@/lib/cms-image";

const MAX_EDGE = 800;

export async function prepareOrbitImage(file: File): Promise<File> {
  if (file.size > CMS_IMAGE_MAX_BYTES || file.size < 96 * 1024 ||
      !["image/jpeg", "image/png"].includes(file.type) || !(await matchesCmsImageType(file))) {
    return file;
  }

  // Keep the submitted original as a fallback on browsers without WebP encoding.
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    try {
      if (!context) return file;
      context.imageSmoothingQuality = "high";
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    } finally {
      bitmap.close();
    }
    const bitmapFile = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.88));
    if (!bitmapFile || bitmapFile.type !== "image/webp" || bitmapFile.size >= file.size) return file;
    return new File([bitmapFile], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: bitmapFile.type });
  } catch {
    return file;
  }
}
