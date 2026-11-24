"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PanelsTopLeft, Pause, Play } from "lucide-react";

import type { PortfolioItem } from "@/lib/data-model";
import { startPreviewScroll } from "./portfolio-preview-motion";
import styles from "./portfolio.module.css";

export function ProjectScrollPreview({ project, liveUrl }: { project: PortfolioItem; liveUrl: string | null }) {
  const { category, title, coverImage, screenshotImage } = project;
  const phone = /\b(?:mobile|ios|android)\b/i.test(category);
  const browser = Boolean(screenshotImage) || (
    !phone && !/\b(?:dashboards?|analytics)\b/i.test(category)
    && /\b(?:web|websites?|e-?commerce|storefront)\b/i.test(category)
  );
  const viewport = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const pausedRef = useRef(false);
  const controls = useRef<ReturnType<typeof startPreviewScroll> | null>(null);
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [loaded, setLoaded] = useState<string | null>(null);
  const [scrollable, setScrollable] = useState(false);

  const cover = coverImage && !failed.includes(coverImage) ? coverImage : null;
  const screenshot = screenshotImage && !failed.includes(screenshotImage) ? screenshotImage : null;
  const source = browser ? screenshot ?? cover : null;
  const imageReady = Boolean(source && loaded === source);
  const preferredSource = Boolean(screenshot);
  const canScroll = imageReady && scrollable;

  useEffect(() => {
    if (!imageReady || !viewport.current || !image.current) return;
    const motion = startPreviewScroll(viewport.current, image.current, preferredSource, setScrollable, pausedRef.current);
    controls.current = motion;
    return () => {
      controls.current = null;
      motion.dispose();
    };
  }, [imageReady, preferredSource]);

  function toggleAutoplay() {
    const value = !pausedRef.current;
    pausedRef.current = value;
    controls.current?.setPaused(value);
    setPaused(value);
  }

  const fallbackCover = cover && !imageReady && cover !== source ? cover : null;
  const markFailed = (key: string) => setFailed((previous) => [...previous, key]);

  return (
    <div className={styles.previewArea}>
      <div
        className={styles.frame}
        data-kind={browser ? "browser" : phone ? "phone" : "screen"}
      >
        {browser && (
          <div className={styles.browserBar}>
            <span className={styles.browserDots} aria-hidden="true"><i /><i /><i /></span>
            <span className={styles.browserAddress}>{liveUrl ? new URL(liveUrl).hostname : title}</span>
            {canScroll && (
              <button type="button" className={styles.previewToggle} onClick={toggleAutoplay}
                aria-label={paused ? "Resume preview autoplay" : "Pause preview autoplay"}>
                {paused ? <Play size={15} aria-hidden /> : <Pause size={15} aria-hidden />}
              </button>
            )}
          </div>
        )}
        <div className={styles.viewport}>
          {!imageReady && (fallbackCover ? (
            <Image
              src={`/api/media/${fallbackCover}`}
              alt={`${title} project cover`}
              fill
              unoptimized
              className={styles.previewCover}
              onError={() => markFailed(fallbackCover)}
            />
          ) : (
            <div className={styles.coverFallback} aria-hidden="true"><span><PanelsTopLeft size={32} strokeWidth={1.3} /></span></div>
          ))}
          {source && (
            <div
              ref={viewport}
              className={styles.viewportScroll}
              data-scrollable={canScroll}
              role={canScroll ? "region" : undefined}
              aria-label={canScroll ? `Scroll ${title} website preview` : undefined}
              tabIndex={canScroll ? 0 : undefined}
            >
              {/* The original screenshot supplies its natural aspect ratio. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={source}
                ref={image}
                src={`/api/media/${source}`}
                alt={`${title} website preview`}
                data-ready={imageReady}
                decoding="async"
                loading="lazy"
                className={styles.screenshot}
                onLoad={() => setLoaded(source)}
                onError={() => markFailed(source)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
