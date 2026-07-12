"use client";

import * as React from "react";

export type MousePosition = { x: number; y: number } | null;

/**
 * Returns a ref containing the current cursor position, updated via
 * requestAnimationFrame — never causes re-renders on mousemove.
 *
 * Returns `null` on coarse-pointer (touch) devices so effects can safely
 * early-return without separate touch-detection logic.
 */
export function useMousePosition(): React.RefObject<MousePosition> {
  const posRef = React.useRef<MousePosition>(null);

  React.useEffect(() => {
    // Disable on touch-primary devices.
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let rafId: number;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        posRef.current = { x: e.clientX, y: e.clientY };
      });
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return posRef;
}
