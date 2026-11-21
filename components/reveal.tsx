"use client";

import { useCallback, useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import styles from "./reveal.module.css";

type RevealEffect = "up" | "from-left" | "from-right" | "scale" | "text" | "fade";

const waiting = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;

function observeReveal(element: HTMLElement) {
  if (typeof IntersectionObserver !== "function" || element.getBoundingClientRect().top < window.innerHeight) return;

  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.12) waiting.get(entry.target)?.();
    }
  }, { threshold: 0.12 });

  const intersection = observer;
  function stop() {
    intersection.unobserve(element);
    waiting.delete(element);
    element.removeEventListener("focusin", reveal);
    if (waiting.size === 0) {
      intersection.disconnect();
      observer = undefined;
    }
  }
  function reveal() {
    element.dataset.scrollReveal = "shown";
    stop();
  }

  waiting.set(element, reveal);
  element.dataset.scrollReveal = "waiting";
  intersection.observe(element);
  element.addEventListener("focusin", reveal);

  return () => {
    if (waiting.has(element)) {
      stop();
      delete element.dataset.scrollReveal;
    }
  };
}

export function ScrollReveal({
  as: Tag = "div",
  effect = "up",
  index = 0,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLElement> & {
  as?: "div" | "header" | "li" | "article" | "dl";
  effect?: RevealEffect;
  index?: number;
}) {
  const target = useRef<HTMLElement | null>(null);
  const setTarget = useCallback((element: HTMLElement | null) => { target.current = element; }, []);

  useEffect(() => {
    if (target.current) return observeReveal(target.current);
  }, []);

  return (
    <Tag
      {...props}
      ref={setTarget}
      className={className ? `${styles.reveal} ${className}` : styles.reveal}
      data-scroll-effect={effect}
      style={{ ...style, "--reveal-delay": `${Math.min(index, 4) * 75}ms` } as CSSProperties}
    />
  );
}
