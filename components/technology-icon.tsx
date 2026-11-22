"use client";

import { useState } from "react";
import Image from "next/image";
import { Code2 } from "lucide-react";

import { technologyIconUrlError } from "@/lib/technology-icon-url";
import { cn } from "@/lib/utils";
import { technologyLogoPaths } from "./technology-logo-paths";

const logoAliases: Record<string, string> = {
  js: "javascript", ts: "typescript", node: "nodedotjs", nodejs: "nodedotjs",
  reactjs: "react", next: "nextdotjs", nextjs: "nextdotjs", postgres: "postgresql",
  tailwind: "tailwindcss", html: "html5", css3: "css", k8s: "kubernetes",
};

type IconProps = {
  name: string;
  iconUrl?: string | null;
  className?: string;
  preview?: boolean;
  preparing?: boolean;
};

export function TechnologyIcon({ iconUrl, ...props }: IconProps) {
  const src = iconUrl && !technologyIconUrlError(iconUrl) ? iconUrl.trim() : "";
  return <TechnologyIconImage key={src} src={src} {...props} />;
}

function TechnologyIconImage({ name, src, className, preview, preparing }: Omit<IconProps, "iconUrl"> & { src: string }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const icon = (
    <span aria-hidden={!preview || undefined} className={cn("relative inline-grid size-6 shrink-0 place-items-center", className)}>
      {(!src || state !== "ready") && <TechnologyGlyph name={name} />}
      {src && state !== "failed" && (
        <Image
          unoptimized
          src={src}
          alt={preview ? (name.trim() ? name + " icon preview" : "Technology icon preview") : ""}
          width={40}
          height={40}
          loading={preview ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          className={cn("absolute inset-0 size-full object-contain", state !== "ready" && "opacity-0")}
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
        />
      )}
    </span>
  );

  if (!preview) return icon;

  const message = preparing || (src && state === "loading")
    ? "Loading icon preview…"
    : src && state === "failed"
      ? "Couldn’t load this image. Check the link or use the fallback icon."
      : src && state === "ready" ? "Icon loaded. Save to use it." : "Fallback preview";

  return (
    <div className="flex items-center gap-3">
      <span className="grid size-16 shrink-0 place-items-center rounded-xl border bg-muted/40">{icon}</span>
      <p role="status" className="text-xs leading-relaxed text-muted-foreground">{message}</p>
    </div>
  );
}

function TechnologyGlyph({ name }: { name: string }) {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const slug = Object.hasOwn(logoAliases, normalized) ? logoAliases[normalized] : normalized;
  const path = Object.hasOwn(technologyLogoPaths, slug) ? technologyLogoPaths[slug] : null;
  return path ? (
    <svg aria-hidden="true" className="size-full" viewBox="0 0 24 24" fill="currentColor"><path d={path} /></svg>
  ) : (
    <Code2 aria-hidden="true" className="size-full" />
  );
}
