"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";

import type { OrbitData } from "@/lib/creative-orbit";
import styles from "./creative-orbit.module.css";

function positionImmersiveOrbit(element: HTMLElement, frames: NodeListOf<HTMLElement>) {
  const measurePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const resize = new ResizeObserver(() => {
    const { clientWidth: width, clientHeight: height } = element;
    const cardWidth = frames[0].offsetWidth;
    if (!width || !height || !cardWidth) return;

    const narrow = width < 768;
    const center = width / 2;
    const sideClearance = narrow ? .7 + Math.max(0, 375 - width) / 190 : .36;
    const radius = center + cardWidth * sideClearance;
    const left = center - radius;
    const right = center + radius;
    const top = cardWidth * .375 + (narrow ? 8 : 12);
    const bottom = height + cardWidth * .07;
    const shoulder = top + (bottom - top) * (narrow ? .12 : .32);
    const turn = radius * .06;
    const upper = `M ${left} ${bottom}
      C ${left} ${shoulder} ${left + turn} ${top} ${center} ${top}
      C ${right - turn} ${top} ${right} ${shoulder} ${right} ${bottom}`;
    const makePath = (depth: number) => `${upper} A ${radius} ${depth} 0 0 1 ${left} ${bottom} Z`.replace(/\s+/g, " ");
    const length = (path: string) => {
      measurePath.setAttribute("d", path);
      return measurePath.getTotalLength();
    };

    // Keep the same spacing along the visible arc. Any extra path needed
    // for a full catalogue belongs below the section, outside the clip.
    const upperLength = length(upper);
    const spacing = cardWidth * 1.28;
    const minimumLoop = frames.length * spacing;
    let depth = Math.max(1, bottom - top);
    if (length(makePath(depth)) < minimumLoop) {
      let far = minimumLoop / 2;
      for (let step = 0; step < 12; step++) {
        const middle = (depth + far) / 2;
        if (length(makePath(middle)) < minimumLoop) depth = middle;
        else far = middle;
      }
      depth = far;
    }

    const path = makePath(depth);
    const first = (upperLength / 2) / length(path);
    element.style.setProperty("--orbit-path", `path("${path}")`);
    frames.forEach((frame, index) => {
      const phase = (1 + first - index / frames.length) % 1;
      frame.parentElement?.style.setProperty("--orbit-phase", String(phase));
    });
    element.dataset.pathReady = "true";
  });
  resize.observe(element);
  resize.observe(frames[0]);
  return () => resize.disconnect();
}

export function CreativeOrbit({ images, settings, previewTheme, immersive = false }: OrbitData & { previewTheme?: "light" | "dark"; immersive?: boolean }) {
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

    let disconnectPath: (() => void) | undefined;
    function syncMotion() {
      focusable.disconnect();
      disconnectPath?.();
      disconnectPath = immersive && !motion.matches ? positionImmersiveOrbit(element!, imageFrames) : undefined;
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
      disconnectPath?.();
      motion.removeEventListener("change", syncMotion);
    };
  }, [images, immersive, rotating, visible]);

  if (!visible) return null;

  return (
    <div
      ref={band}
      className={styles.orbit}
      data-immersive={immersive || undefined}
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
                sizes={immersive
                  ? "(min-width: 64rem) 340px, (min-width: 48rem) 256px, 132px"
                  : "(min-width: 64rem) 138px, (min-width: 48rem) 100px, 65px"}
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
