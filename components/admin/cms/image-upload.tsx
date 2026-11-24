"use client";

import * as React from "react";
import Image from "next/image";
import { ImageUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Uploads an image to R2 via POST /api/media and hands back the object *key*
 * (stored in PortfolioItem.coverImage / TeamMember.photoUrl). The stored key is
 * rendered through GET /api/media/<key>.
 */
export function ImageUpload({
  value,
  onChange,
  label = "Image",
  tallPreview = false,
}: {
  value: string | null;
  onChange: (key: string | null) => void;
  label?: string;
  tallPreview?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [failedPreview, setFailedPreview] = React.useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/media", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as {
        key?: string;
        error?: string;
      } | null;

      if (!res.ok || !body?.key) {
        throw new Error(body?.error ?? "Upload failed");
      }
      onChange(body.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Preview */}
        <div className={`relative grid w-16 shrink-0 place-items-center overflow-hidden rounded-lg border border-border/60 bg-secondary ${tallPreview ? "h-28" : "h-16"}`}>
          {value && failedPreview !== value ? (
            <Image
              src={`/api/media/${value}`}
              alt={tallPreview ? "Full-page screenshot preview" : ""}
              fill
              sizes="64px"
              className={tallPreview ? "object-contain" : "object-cover"}
              unoptimized
              onError={tallPreview ? () => setFailedPreview(value) : undefined}
            />
          ) : (
            <ImageUp className="size-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <ImageUp className="size-4" />
                  {value ? "Replace" : `Upload ${label.toLowerCase()}`}
                </>
              )}
            </Button>

            {value && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(null)}
                className="text-destructive hover:text-destructive"
              >
                <X className="size-4" />
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPEG, WebP or AVIF · max 5MB
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {tallPreview && value && failedPreview === value && (
        <p role="status" className="text-xs text-muted-foreground">This screenshot couldn’t be loaded. Replace it to restore the preview.</p>
      )}
    </div>
  );
}
