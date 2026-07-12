"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Max tilt angle in degrees (default 8) */
  maxTilt?: number;
  /** Glare intensity 0–1 (default 0.15) */
  glareIntensity?: number;
}

/**
 * 3-D tilt card with a moving glare highlight and gradient border glow.
 *
 * All transforms are applied directly to the DOM node via ref.style —
 * zero React state on mousemove, zero layout thrash.
 *
 * Uses:
 *  - perspective + transform-style: preserve-3d for the 3D effect
 *  - A glare ::before overlay positioned via CSS custom props
 *  - A gradient border glow that activates on hover via CSS transition
 *
 * Disabled on:
 *  - prefers-reduced-motion
 *  - touch / coarse-pointer devices
 */
export function TiltCard({
  children,
  className,
  maxTilt = 8,
  glareIntensity = 0.15,
}: TiltCardProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const glareRef = React.useRef<HTMLDivElement>(null);
  const borderRef = React.useRef<HTMLDivElement>(null);

  const [disabled, setDisabled] = React.useState(false);

  React.useEffect(() => {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setDisabled(coarse || reduced);
  }, []);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      // Normalised position within card: -1 → +1
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = ((e.clientY - rect.top) / rect.height) * 2 - 1;

      const rotY = nx * maxTilt;
      const rotX = -ny * maxTilt;

      // Apply 3D tilt
      containerRef.current.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.02,1.02,1.02)`;

      // Move glare overlay
      if (glareRef.current) {
        const glareX = ((e.clientX - rect.left) / rect.width) * 100;
        const glareY = ((e.clientY - rect.top) / rect.height) * 100;
        glareRef.current.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,${glareIntensity}), transparent 60%)`;
        glareRef.current.style.opacity = "1";
      }

      // Move gradient border glow
      if (borderRef.current) {
        const bx = ((e.clientX - rect.left) / rect.width) * 100;
        const by = ((e.clientY - rect.top) / rect.height) * 100;
        borderRef.current.style.background = `radial-gradient(circle at ${bx}% ${by}%, color-mix(in oklch, var(--color-brand-secondary) 60%, var(--color-accent-cyan)) 0%, transparent 55%)`;
        borderRef.current.style.opacity = "1";
      }
    },
    [disabled, maxTilt, glareIntensity]
  );

  const handleMouseLeave = React.useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.style.transform =
      "perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)";
    if (glareRef.current) glareRef.current.style.opacity = "0";
    if (borderRef.current) borderRef.current.style.opacity = "0";
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative will-change-transform", className)}
      style={{
        transformStyle: "preserve-3d",
        transition: disabled
          ? undefined
          : "transform 0.35s cubic-bezier(0.03,0.98,0.52,0.99)",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Gradient border glow — sits just outside the card boundary */}
      {!disabled && (
        <div
          ref={borderRef}
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-xl"
          style={{
            opacity: 0,
            transition: "opacity 0.3s ease",
            zIndex: 0,
            padding: "1px",
            // We use a box-shadow approach for the glow ring
            boxShadow:
              "0 0 0 1px color-mix(in oklch, var(--color-brand-secondary) 40%, transparent), 0 0 20px 2px color-mix(in oklch, var(--color-brand-secondary) 20%, transparent)",
          }}
        />
      )}

      {/* Children sit at z:1 so they're above the border glow */}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>

      {/* Glare overlay — top layer */}
      {!disabled && (
        <div
          ref={glareRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-xl"
          style={{
            opacity: 0,
            transition: "opacity 0.2s ease",
            zIndex: 2,
            mixBlendMode: "soft-light",
          }}
        />
      )}
    </div>
  );
}
