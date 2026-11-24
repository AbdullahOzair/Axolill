"use client";

import { useEffect, useRef, type ReactNode } from "react";

import styles from "./why-choose.module.css";

export function WhyChooseGrid({ children }: { children: ReactNode }) {
  const grid = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const element = grid.current;
    if (!element) return;
    const motion = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    let cell: HTMLElement | undefined;
    let glass: HTMLElement | null = null;

    function reset() {
      glass?.style.removeProperty("--why-tilt-x");
      glass?.style.removeProperty("--why-tilt-y");
      glass?.style.removeProperty("--why-reflection");
      cell = undefined;
      glass = null;
    }

    function move(event: PointerEvent) {
      if (!motion.matches || event.pointerType !== "mouse" || !(event.target instanceof Element)) return;
      const target = event.target.closest<HTMLElement>("[data-reason]");
      if (target !== cell) {
        reset();
        cell = target ?? undefined;
        glass = target?.querySelector<HTMLElement>("[data-glass]") ?? null;
      }
      if (!cell || !glass) return;

      const bounds = cell.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, 2 * (event.clientX - bounds.left) / bounds.width - 1));
      const y = Math.max(-1, Math.min(1, 2 * (event.clientY - bounds.top) / bounds.height - 1));
      glass.style.setProperty("--why-tilt-x", `${y * -3.5}deg`);
      glass.style.setProperty("--why-tilt-y", `${x * 3.5}deg`);
      glass.style.setProperty("--why-reflection", `${50 + x * 42}%`);
    }

    function leave(event: PointerEvent) {
      if (cell && (!(event.relatedTarget instanceof Node) || !cell.contains(event.relatedTarget))) reset();
    }

    element.addEventListener("pointermove", move, { passive: true });
    element.addEventListener("pointerout", leave, { passive: true });
    motion.addEventListener("change", reset);
    return () => {
      reset();
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerout", leave);
      motion.removeEventListener("change", reset);
    };
  }, []);

  return <ul ref={grid} className={styles.grid}>{children}</ul>;
}
