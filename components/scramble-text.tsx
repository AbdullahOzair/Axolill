"use client";

import * as React from "react";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const rand = () => CHARS[Math.floor(Math.random() * CHARS.length)];

interface ScrambleTextProps {
  text: string;
  className?: string;
  /** Total animation duration in ms (default 1400). Longer = slower, more cinematic. */
  duration?: number;
  /** How often in ms to swap scramble chars (default 60ms ≈ every 4 frames). Higher = calmer. */
  scrambleInterval?: number;
}

/**
 * On hover, characters scramble through random glyphs before settling
 * left-to-right — a slow, cinematic futuristic decode effect.
 *
 * - Time-based via performance.now() for consistent speed at any refresh rate.
 * - Random chars swap only every `scrambleInterval` ms, NOT every rAF frame,
 *   so it looks deliberate rather than frantic.
 * - No setState on any frame — all DOM writes go through spanRef directly.
 * - Respects prefers-reduced-motion.
 */
export function ScrambleText({
  text,
  className,
  duration = 1400,
  scrambleInterval = 60,
}: ScrambleTextProps) {
  const spanRef = React.useRef<HTMLSpanElement>(null);
  const rafRef = React.useRef<number>(0);
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const scramble = React.useCallback(() => {
    if (reduced || !spanRef.current) return;
    cancelAnimationFrame(rafRef.current);

    const letters = text.split("");
    const revealed = new Array<boolean>(letters.length).fill(false);
    // Cache one random char per position; only refresh on each interval tick
    const randoms = letters.map(() => rand());
    const startTime = performance.now();
    let lastSwap = startTime;

    const animate = (now: number) => {
      if (!spanRef.current) return;

      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Reveal characters left-to-right proportionally to time elapsed
      const revealCount = Math.floor(progress * letters.length);
      for (let i = 0; i < revealCount; i++) {
        revealed[i] = true;
      }

      // Only swap scramble chars every `scrambleInterval` ms — prevents flicker
      if (now - lastSwap >= scrambleInterval) {
        for (let i = revealCount; i < letters.length; i++) {
          if (letters[i] !== " ") randoms[i] = rand();
        }
        lastSwap = now;
      }

      const display = letters.map((char, i) => {
        if (char === " ") return " ";
        if (revealed[i]) return char;
        return randoms[i];
      });

      spanRef.current.textContent = display.join("");

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        spanRef.current.textContent = text;
      }
    };

    rafRef.current = requestAnimationFrame(animate);
  }, [text, duration, scrambleInterval, reduced]);

  const reset = React.useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (spanRef.current) spanRef.current.textContent = text;
  }, [text]);

  React.useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <span
      ref={spanRef}
      className={className}
      onMouseEnter={scramble}
      onMouseLeave={reset}
      style={{ display: "inline-block" }}
    >
      {text}
    </span>
  );
}
