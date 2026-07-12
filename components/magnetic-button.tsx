"use client";

import * as React from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";

interface MagneticButtonProps {
  children: React.ReactNode;
  className?: string;
  /** Maximum displacement in px (default 10) */
  strength?: number;
}

/**
 * Wraps any element with a magnetic pull effect — the element nudges
 * toward the cursor when hovered, snapping back via a spring on leave.
 *
 * Uses Framer Motion useSpring → transform, so all updates are
 * compositor-only. No state is set on mousemove.
 *
 * Disabled on:
 *   - prefers-reduced-motion
 *   - touch / coarse-pointer devices
 */
export function MagneticButton({
  children,
  className,
  strength = 10,
}: MagneticButtonProps) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 300, damping: 22, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 300, damping: 22, mass: 0.5 });

  // Disable on coarse-pointer devices
  const [isCoarse, setIsCoarse] = React.useState(false);
  React.useEffect(() => {
    setIsCoarse(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduce || isCoarse || !ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = ((e.clientX - cx) / (rect.width / 2)) * strength;
      const dy = ((e.clientY - cy) / (rect.height / 2)) * strength;
      rawX.set(dx);
      rawY.set(dy);
    },
    [reduce, isCoarse, strength, rawX, rawY]
  );

  const handleMouseLeave = React.useCallback(() => {
    rawX.set(0);
    rawY.set(0);
  }, [rawX, rawY]);

  if (reduce || isCoarse) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </motion.div>
  );
}
