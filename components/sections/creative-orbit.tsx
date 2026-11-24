"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";

import type { OrbitData } from "@/lib/creative-orbit";
import styles from "./creative-orbit.module.css";

export function CreativeOrbit({ images, settings, previewTheme }: OrbitData & { previewTheme?: "light" | "dark" }) {
  const band = useRef<HTMLDivElement>(null);
  const visible = settings.enabled && images.length > 0;
  const rotating = images.length > 1;

  useEffect(() => {
    const element = band.current;
    if (!element || !rotating) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const imageFrames = element.querySelectorAll<HTMLElement>("[data-orbit-image]");
    const viewport = new IntersectionObserver(([entry]) => {
      element.dataset.visible = String(entry.isIntersecting);
    });
    const focusable = new IntersectionObserver((entries) => {
      for (const { target, intersectionRatio } of entries) {
        (target as HTMLElement).tabIndex = motion.matches || intersectionRatio >= 0.8 ? 0 : -1;
      }
    }, { root: element, threshold: 0.8 });

    function syncMotion() {
      focusable.disconnect();
      for (const frame of imageFrames) {
        frame.tabIndex = motion.matches ? 0 : -1;
        if (!motion.matches) focusable.observe(frame);
      }
    }

    viewport.observe(element);
    syncMotion();
    motion.addEventListener("change", syncMotion);
    return () => {
      viewport.disconnect();
      focusable.disconnect();
      motion.removeEventListener("change", syncMotion);
    };
  }, [images, rotating, visible]);

  if (!visible) return null;

  return (
    <div
      ref={band}
      className={styles.orbit}
      data-single={!rotating || undefined}
      data-preview-theme={previewTheme}
      data-direction={settings.direction}
      style={{ "--orbit-duration": `${settings.duration}s` } as CSSProperties}
      role="group"
      aria-label="Creative Orbit project images"
    >
      <div className={styles.rotor}>
        {images.map(({ id, title, alt, imageKey }, index) => (
          <div key={id} className={styles.slot} style={{ "--slot-angle": `${index * 360 / images.length}deg` } as CSSProperties}>
            <div className={styles.frame} data-orbit-image tabIndex={rotating ? -1 : 0} title={title ?? undefined}>
              <Image
                src={`/api/media/${imageKey}`}
                alt={alt}
                fill
                unoptimized
                sizes="(min-width: 64rem) 138px, (min-width: 48rem) 100px, 65px"
                className={styles.image}
                draggable={false}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
