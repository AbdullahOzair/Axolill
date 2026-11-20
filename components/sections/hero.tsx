"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Database, Play, Sparkles } from "lucide-react";
import { gsap } from "gsap";
import {
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  GithubIcon,
  NextjsIcon,
  PythonIcon,
  ReactIcon,
} from "@/components/brand-icons";
import { MagneticButton } from "@/components/magnetic-button";
import { BookingLink } from "@/components/booking-provider";
import styles from "./hero-entrance.module.css";

const HEADLINE_LEAD = "We Turn ideas into";
const HEADLINE_ACCENT = "scalable digital products";
let hasPlayedEntrance = false;

type FloatingIcon = {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  className: string; // positioning
  color: string; // icon color
  drift: { x: number[]; y: number[]; duration: number; delay: number };
};

const FLOATING_ICONS: FloatingIcon[] = [
  {
    label: "React",
    Icon: ReactIcon,
    className: "left-[6%] top-[24%] sm:left-[10%]",
    color: "text-[#61DAFB]",
    drift: { x: [0, 8, 0], y: [0, -16, 0], duration: 7, delay: 0 },
  },
  {
    label: "Next.js",
    Icon: NextjsIcon,
    className: "right-[8%] top-[18%] sm:right-[14%]",
    color: "text-foreground",
    drift: { x: [0, -10, 0], y: [0, 14, 0], duration: 8.5, delay: 0.6 },
  },
  {
    label: "Python",
    Icon: PythonIcon,
    className: "left-[12%] bottom-[16%] sm:left-[18%]",
    color: "text-[#3776AB] dark:text-[#4B8BBE]",
    drift: { x: [0, 12, 0], y: [0, 12, 0], duration: 9, delay: 1.1 },
  },
  {
    label: "AI",
    Icon: ({ className }) => <Sparkles className={className} />,
    className: "right-[10%] bottom-[22%] sm:right-[16%]",
    color: "text-accent-cyan",
    drift: { x: [0, -8, 0], y: [0, -12, 0], duration: 7.8, delay: 0.3 },
  },
  {
    label: "VS Code",
    Icon: VsCodeIcon,
    className: "left-[29%] top-[8%]",
    color: "text-[#007ACC] dark:text-[#40A8F1]",
    drift: { x: [0, -10, 0], y: [0, 12, 0], duration: 8.2, delay: 0.2 },
  },
  {
    label: "GitHub",
    Icon: GithubIcon,
    className: "right-[30%] bottom-[7%]",
    color: "text-foreground",
    drift: { x: [0, 10, 0], y: [0, -10, 0], duration: 8.8, delay: 0.5 },
  },
  {
    label: "Database",
    Icon: Database,
    className: "right-[31%] top-[9%]",
    color: "text-emerald-600 dark:text-emerald-400",
    drift: { x: [0, 9, 0], y: [0, -10, 0], duration: 7.6, delay: 0.8 },
  },
];

function VsCodeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.15 2.588 18.21.21a1.5 1.5 0 0 0-1.71.29L7.125 9.055 3.04 5.96a1 1 0 0 0-1.28.057L.44 7.22a1 1 0 0 0-.008 1.472L4.054 12 .432 15.308a1 1 0 0 0 .007 1.472l1.32 1.203a1 1 0 0 0 1.28.057l4.086-3.095L16.5 23.5a1.5 1.5 0 0 0 1.71.29l4.94-2.378A1.5 1.5 0 0 0 24 20.06V3.94a1.5 1.5 0 0 0-.85-1.352ZM18 17.45 10.805 12 18 6.55Z" />
    </svg>
  );
}

export function Hero() {
  const reduce = useReducedMotion();
  const sectionRef = React.useRef<HTMLElement>(null);

  React.useLayoutEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const text = Array.from(section.querySelectorAll<HTMLElement>("[data-hero-reveal]"))
      .filter((element) => getComputedStyle(element).opacity === "0");
    const cards = Array.from(section.querySelectorAll<HTMLElement>("[data-hero-icon]"));
    if (hasPlayedEntrance || preference.matches || !cards.length || section.getBoundingClientRect().bottom <= 0) {
      section.dataset.heroIntro = "done";
      return;
    }

    const mobile = cards[0].offsetWidth === 0;
    section.dataset.heroIntro = "running";
    const centerX = section.clientWidth / 2;
    const centerY = section.clientHeight / 2;
    const icons = cards
      .map((icon) => {
        const x = icon.offsetLeft + icon.offsetWidth / 2 - centerX;
        const y = icon.offsetTop + icon.offsetHeight / 2 - centerY;
        return { icon, x, y, angle: Math.atan2(y, x) };
      })
      .sort((a, b) => a.angle - b.angle);
    const orderedCards = icons.map(({ icon }) => icon);
    const radius = mobile ? 23 : 31;
    let timeline: gsap.core.Timeline;
    const context = gsap.context(() => {
      icons.forEach(({ icon, x, y }, index) => {
        const angle = icons[0].angle + index * 2 * Math.PI / icons.length;
        gsap.set(icon, { x: Math.cos(angle) * radius - x, y: Math.sin(angle) * radius - y, scale: 0.78, opacity: 0 });
      });
      if (text.length) gsap.set(text, { y: 16, opacity: 0 });

      timeline = gsap.timeline({ paused: true, defaults: { ease: "power3.out" }, onComplete: () => {
        section.dataset.heroIntro = "done";
      } });
      timeline
        .to(orderedCards, { opacity: 1, duration: 0.19, stagger: 0.014 }, 0)
        .to(orderedCards, { x: 0, y: 0, scale: 1, duration: 0.88, stagger: 0.065 }, 0.17);
      // On slow connections, keep any copy the visitor can already read visible.
      if (text.length) timeline.to(text, { y: 0, opacity: 1, duration: 0.65, stagger: 0.095 }, 0.49);
      // Mobile shows the burst, then restores the existing icon-free layout.
      if (mobile) timeline.to(cards, { opacity: 0, duration: 0.4, stagger: 0.025 }, 0.62);
      timeline.set([...cards, ...text], { clearProps: "transform,opacity" });
    }, section);

    const start = requestAnimationFrame(() => {
      hasPlayedEntrance = true;
      timeline.play();
    });
    const finish = () => {
      hasPlayedEntrance = true;
      timeline.progress(1).pause();
    };
    const onPreferenceChange = () => { if (preference.matches) finish(); };
    preference.addEventListener("change", onPreferenceChange);
    section.addEventListener("focusin", finish);
    return () => {
      cancelAnimationFrame(start);
      preference.removeEventListener("change", onPreferenceChange);
      section.removeEventListener("focusin", finish);
      context.revert();
      section.dataset.heroIntro = hasPlayedEntrance ? "done" : "pending";
    };
  }, []);

  // Parallax: update CSS vars on mousemove via rAF — no state updates.
  React.useEffect(() => {
    if (reduce) return;
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    if (coarse) return;

    let rafId: number;
    const el = sectionRef.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        // Normalised offset from center: -1 → +1
        const nx = (e.clientX - rect.left) / rect.width - 0.5;
        const ny = (e.clientY - rect.top) / rect.height - 0.5;

        // Drive each parallax blob wrapper
        el.querySelectorAll<HTMLElement>("[data-parallax-x]").forEach((node) => {
          const fx = parseFloat(node.dataset.parallaxX ?? "0");
          const fy = parseFloat(node.dataset.parallaxY ?? "0");
          const tx = nx * window.innerWidth * fx;
          const ty = ny * window.innerHeight * fy;
          node.style.transform = `translate3d(${tx}px,${ty}px,0)`;
        });
      });
    };

    el.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      el.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, [reduce]);


  return (
    <section
      ref={sectionRef}
      id="hero"
      data-hero-intro="pending"
      className={cn("group/hero relative isolate overflow-hidden", styles.hero)}
      aria-labelledby="hero-heading"
    >
      <HeroBackground reduce={!!reduce} />
      <FloatingIcons reduce={!!reduce} sectionRef={sectionRef} />

      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col items-center justify-center px-4 py-24 text-center sm:px-6">
        <div className="flex flex-col items-center">
          <div data-hero-reveal>
            <Badge
              variant="secondary"
              className="mb-6 gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 backdrop-blur"
            >
              <Sparkles className="size-3.5 text-accent-cyan" />
              <span className="text-xs font-medium">
                Digital product studio
              </span>
            </Badge>
          </div>

          <h1
            id="hero-heading"
            data-hero-reveal
            className="max-w-4xl font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl lg:text-7xl"
          >
            {HEADLINE_LEAD}{" "}
            <span className="bg-gradient-to-r from-brand-secondary via-accent-cyan to-brand-secondary bg-clip-text text-transparent">
              {HEADLINE_ACCENT}
            </span>
            .
          </h1>

          <p
            data-hero-reveal
            className="mt-6 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg"
          >
            We design and build web apps, mobile apps and AI features for founders 
            and growing teams. You work directly with the people building your 
            product, from the first call to launch and beyond 
          </p>

          <div
            data-hero-reveal
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            {/* Primary — gradient reveal on hover + magnetic pull */}
            <MagneticButton strength={8}>
              <BookingLink
                className="group relative inline-flex h-11 items-center justify-center gap-2 overflow-hidden rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:shadow-md hover:shadow-brand-secondary/25 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-brand-secondary to-accent-cyan opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                <span className="relative z-10 flex items-center gap-2">
                  Book a Free Call
                  <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </BookingLink>
            </MagneticButton>

            {/* Secondary — outline + magnetic pull */}
            <MagneticButton strength={8}>
              <Link
                href="#work"
                className="group inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background/60 px-6 text-sm font-medium text-foreground shadow-sm backdrop-blur transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Play className="size-4 text-brand-secondary transition-transform duration-300 group-hover:scale-110" />
                See Our Work
              </Link>
            </MagneticButton>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Grid + slowly morphing gradient-mesh blobs with mouse-parallax. */
function HeroBackground({ reduce }: { reduce: boolean }) {
  const blobTransition = (duration: number): Transition => ({
    duration,
    repeat: Infinity,
    repeatType: "mirror",
    ease: "easeInOut",
  });

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
      {/* Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:56px_56px] opacity-40 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_40%,black,transparent)] dark:opacity-30" />

      {/*
        Parallax wrapper pattern:
        - Each blob lives inside a <div data-parallax-x data-parallax-y>.
        - The Hero mousemove listener queries [data-parallax-x] and updates
          their translateX/Y directly, no React state, no re-render.
        - Framer Motion handles the slow organic drift on the inner blob div.
      */}

      {/* Blob 1 — blue/secondary, top-left */}
      <div
        data-parallax-x="-0.04"
        data-parallax-y="-0.03"
        className="absolute -top-24 left-1/4 will-change-transform"
        style={{ transition: reduce ? undefined : "transform 0.15s linear" }}
      >
        <motion.div
          className="size-[36rem] rounded-full bg-brand-secondary/25 blur-3xl dark:bg-brand-secondary/20"
          animate={
            reduce ? undefined : { x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.1, 0.95, 1] }
          }
          transition={reduce ? undefined : blobTransition(18)}
        />
      </div>

      {/* Blob 2 — cyan, top-right */}
      <div
        data-parallax-x="0.035"
        data-parallax-y="0.025"
        className="absolute top-10 right-1/4 will-change-transform"
        style={{ transition: reduce ? undefined : "transform 0.15s linear" }}
      >
        <motion.div
          className="size-[30rem] rounded-full bg-accent-cyan/25 blur-3xl dark:bg-accent-cyan/15"
          animate={
            reduce ? undefined : { x: [0, -30, 25, 0], y: [0, 25, -15, 0], scale: [1, 0.95, 1.1, 1] }
          }
          transition={reduce ? undefined : blobTransition(22)}
        />
      </div>

      {/* Blob 3 — green/success, bottom */}
      <div
        data-parallax-x="0.02"
        data-parallax-y="-0.025"
        className="absolute bottom-0 left-1/3 will-change-transform"
        style={{ transition: reduce ? undefined : "transform 0.15s linear" }}
      >
        <motion.div
          className="size-[26rem] rounded-full bg-brand-success/15 blur-3xl"
          animate={
            reduce ? undefined : { x: [0, 20, -25, 0], y: [0, -20, 15, 0], scale: [1, 1.08, 0.9, 1] }
          }
          transition={reduce ? undefined : blobTransition(20)}
        />
      </div>
    </div>
  );
}


type Point = { x: number; y: number };

function FloatingIcons({ reduce, sectionRef }: {
  reduce: boolean;
  sectionRef: React.RefObject<HTMLElement | null>;
}) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const [collected, setCollected] = React.useState<string[]>([]);

  React.useEffect(() => {
    const section = sectionRef.current;
    const layer = layerRef.current;
    if (!section || !layer || reduce) return;

    const hover = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const returning = new Map<HTMLElement, Animation>();
    let chain: { card: HTMLElement; origin: Point; position: Point; scale: number }[] = [];
    let trail: Point[] = [];
    let pointer: Point = { x: 0, y: 0 };
    let frame: number | undefined;
    let previousTime = 0;

    function animate(time: number) {
      frame = undefined;
      if (!layer || !chain.length) return;
      const bounds = layer.getBoundingClientRect();
      const elapsed = previousTime ? Math.min(time - previousTime, 32) : 16;
      previousTime = time;

      const leader = chain[0];
      const head = {
        x: Math.min(bounds.width - 26, Math.max(26, pointer.x - bounds.left + 16)),
        y: Math.min(bounds.height - 26, Math.max(26, pointer.y - bounds.top + 24)),
      };
      const follow = 1 - Math.exp(-elapsed / 55);
      leader.position.x += (head.x - leader.position.x) * follow;
      leader.position.y += (head.y - leader.position.y) * follow;

      // Sample the leader's path so the other icons trace its turns at even intervals.
      const last = trail[0];
      if (Math.hypot(leader.position.x - last.x, leader.position.y - last.y) >= 3) {
        trail.unshift({ ...leader.position });
        if (trail.length > 80) trail.pop();
      }

      let sample = 0;
      let distance = 0;
      let remaining = Math.hypot(head.x - leader.position.x, head.y - leader.position.y);
      for (const [index, tile] of chain.entries()) {
        if (index > 0) {
          const spacing = index * 31;
          while (sample < trail.length - 1) {
            const from = trail[sample];
            const to = trail[sample + 1];
            const length = Math.hypot(to.x - from.x, to.y - from.y);
            if (distance + length >= spacing) break;
            distance += length;
            sample += 1;
          }
          const from = trail[sample];
          const to = trail[sample + 1] ?? from;
          const length = Math.hypot(to.x - from.x, to.y - from.y);
          const fraction = length ? (spacing - distance) / length : 0;
          const dx = from.x + (to.x - from.x) * fraction - tile.position.x;
          const dy = from.y + (to.y - from.y) * fraction - tile.position.y;
          tile.position.x += dx * follow;
          tile.position.y += dy * follow;
          remaining = Math.max(remaining, Math.hypot(dx, dy));
        }
        tile.scale += (0.7 - tile.scale) * follow;
        remaining = Math.max(remaining, Math.abs(0.7 - tile.scale) * 64);
        tile.card.style.transform = `translate3d(${tile.position.x - tile.origin.x}px, ${tile.position.y - tile.origin.y}px, 0) scale(${tile.scale})`;
      }
      if (remaining > 0.2) frame = requestAnimationFrame(animate);
      else previousTime = 0;
    }

    function handleMove(event: PointerEvent) {
      if (!layer || section?.dataset.heroIntro === "running" || event.pointerType !== "mouse" || !hover.matches || reducedMotion.matches) return;
      pointer = { x: event.clientX, y: event.clientY };
      const target = event.target instanceof Element && event.target.closest<HTMLElement>("[data-hero-icon]");
      const label = target && target.dataset.heroIcon;
      if (target && label && layer.contains(target) && !chain.some(({ card }) => card === target)) {
        const bounds = layer.getBoundingClientRect();
        const rect = target.getBoundingClientRect();
        const homeward = returning.get(target);
        if (homeward) {
          target.style.transform = getComputedStyle(target).transform;
          homeward.onfinish = null;
          homeward.cancel();
          returning.delete(target);
        }
        const tile = {
          card: target,
          origin: { x: target.offsetLeft + target.offsetWidth / 2, y: target.offsetTop + target.offsetHeight / 2 },
          position: { x: rect.left - bounds.left + rect.width / 2, y: rect.top - bounds.top + rect.height / 2 },
          scale: rect.width / target.offsetWidth,
        };
        if (!chain.length) trail = [{ ...tile.position }];
        target.style.zIndex = String(FLOATING_ICONS.length - chain.length);
        chain.push(tile);
        setCollected((previous) => [...previous, label]);
      }
      if (chain.length) frame ??= requestAnimationFrame(animate);
    }

    function reset() {
      if (!chain.length) return;
      if (frame !== undefined) cancelAnimationFrame(frame);
      frame = undefined;
      for (const [index, { card, origin, position }] of chain.entries()) {
        if (!card.style.transform || reducedMotion.matches) {
          card.style.transform = "";
          card.style.zIndex = "";
          continue;
        }

        const distance = Math.hypot(position.x - origin.x, position.y - origin.y);
        // Hold each icon at its last trail position until its return starts.
        const animation = card.animate(
          [{ transform: card.style.transform }, { transform: "translate3d(0, 0, 0) scale(1)" }],
          {
            delay: index * 45,
            duration: Math.min(1200, 650 + distance * 0.7),
            easing: "cubic-bezier(0.4, 0, 0.2, 1)",
            fill: "both",
          },
        );
        returning.set(card, animation);
        card.style.transform = "";
        animation.onfinish = () => {
          card.style.zIndex = "";
          returning.delete(card);
          animation.cancel();
        };
      }
      chain = [];
      trail = [];
      previousTime = 0;
      setCollected([]);
    }

    function resetOnScroll() {
      if (!section || !chain.length) return;
      const { top, right, bottom, left } = section.getBoundingClientRect();
      if (pointer.x < left || pointer.x >= right || pointer.y < top || pointer.y >= bottom) reset();
    }

    function cancelReturns() {
      for (const [card, animation] of returning) {
        animation.onfinish = null;
        animation.cancel();
        card.style.zIndex = "";
      }
      returning.clear();
    }

    function handleMotionPreference() {
      reset();
      if (reducedMotion.matches) cancelReturns();
    }

    section.addEventListener("pointermove", handleMove, { passive: true });
    section.addEventListener("pointerleave", reset);
    section.addEventListener("pointercancel", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("resize", reset);
    window.addEventListener("scroll", resetOnScroll, { passive: true });
    hover.addEventListener("change", reset);
    reducedMotion.addEventListener("change", handleMotionPreference);
    return () => {
      section.removeEventListener("pointermove", handleMove);
      section.removeEventListener("pointerleave", reset);
      section.removeEventListener("pointercancel", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("resize", reset);
      window.removeEventListener("scroll", resetOnScroll);
      hover.removeEventListener("change", reset);
      reducedMotion.removeEventListener("change", handleMotionPreference);
      reset();
      cancelReturns();
    };
  }, [reduce, sectionRef]);

  return (
    <div ref={layerRef} aria-hidden className="pointer-events-none absolute inset-0 z-10 hidden group-data-[hero-intro=running]/hero:block md:block">
      {FLOATING_ICONS.map(({ label, Icon, className, color, drift }) => {
        const chasing = collected.includes(label);
        return (
          <div
            key={label}
            data-hero-icon={label}
            className={cn("absolute", chasing && "will-change-transform", className)}
          >
            <motion.div
              className={cn(
                "grid size-10 place-items-center border shadow-lg transition-[background-color,border-color,border-radius] duration-300 motion-reduce:pointer-events-none! motion-reduce:transform-none! motion-reduce:transition-none md:size-14 lg:size-16",
                chasing
                  ? "rounded-full border-accent-cyan/40 bg-background/95"
                  : "rounded-2xl border-border/60 bg-background/50 backdrop-blur-md",
                !reduce && !chasing && "[@media(hover:hover)_and_(pointer:fine)]:pointer-events-auto group-data-[hero-intro=running]/hero:pointer-events-none!",
              )}
              animate={reduce || chasing ? { x: 0, y: 0 } : { x: drift.x, y: drift.y }}
              transition={reduce || chasing ? { duration: reduce ? 0 : 0.24 } : {
                duration: drift.duration,
                delay: drift.delay,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
            >
              <Icon className={cn("size-5 md:size-7 lg:size-8", color)} />
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
