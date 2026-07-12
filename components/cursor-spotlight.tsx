"use client";

import * as React from "react";
import { useMousePosition } from "@/hooks/use-mouse-position";

/**
 * Full-viewport soft radial-gradient glow that follows the cursor.
 *
 * Implemented as a fixed overlay div whose background-position is updated
 * directly via ref.style — no React state, no re-renders, GPU-composited.
 *
 * Disabled automatically on:
 *   - touch / coarse-pointer devices (useMousePosition returns null)
 *   - prefers-reduced-motion (gradient is static / hidden)
 */
export function CursorSpotlight() {
  const blobRef = React.useRef<HTMLDivElement>(null);
  const mousePos = useMousePosition();

  // Respect prefers-reduced-motion
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Animate blob position on every animation frame
  React.useEffect(() => {
    if (reduced) return;
    let rafId: number;

    const tick = () => {
      const pos = mousePos.current;
      if (pos && blobRef.current) {
        blobRef.current.style.transform = `translate3d(${pos.x - 300}px, ${pos.y - 300}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reduced, mousePos]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        ref={blobRef}
        className="absolute size-[600px] rounded-full opacity-0 will-change-transform"
        style={{
          // Transition only opacity (for fade-in), not transform (rAF handles that)
          transition: "opacity 1s ease",
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--color-brand-secondary) 18%, transparent) 0%, color-mix(in oklch, var(--color-accent-cyan) 8%, transparent) 40%, transparent 70%)",
          filter: "blur(40px)",
        }}
        onMouseEnter={(e) => {
          // Use the parent's animation — this div should never capture events
          void e;
        }}
      />
      {/* Fade in once mouse has moved */}
      <style>{`
        .spotlight-active { opacity: 1 !important; }
      `}</style>
    </div>
  );
}

/**
 * Provider that activates the spotlight blob opacity on first mouse move.
 * Placed at layout level to cover the whole page.
 */
export function CursorSpotlightProvider() {
  const blobRef = React.useRef<HTMLDivElement>(null);
  const mousePos = useMousePosition();
  const activated = React.useRef(false);

  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    if (reduced) return;
    let rafId: number;

    const tick = () => {
      const pos = mousePos.current;
      if (pos && blobRef.current) {
        // Activate opacity on first move
        if (!activated.current) {
          blobRef.current.style.opacity = "1";
          activated.current = true;
        }
        blobRef.current.style.transform = `translate3d(${pos.x - 300}px, ${pos.y - 300}px, 0)`;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [reduced, mousePos]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <div
        ref={blobRef}
        className="absolute size-[600px] rounded-full will-change-transform"
        style={{
          opacity: 0,
          transition: "opacity 0.8s ease",
          background:
            "radial-gradient(circle at center, color-mix(in oklch, var(--color-brand-secondary) 20%, transparent) 0%, color-mix(in oklch, var(--color-accent-cyan) 10%, transparent) 45%, transparent 70%)",
          filter: "blur(48px)",
        }}
      />
    </div>
  );
}
