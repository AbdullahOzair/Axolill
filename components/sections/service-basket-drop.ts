import { gsap } from "gsap";

const DURATION = 2.15;
const STEP = 1 / 120;
const CEILING = 4;
const CLEARANCE = 3;

type Pill = {
  element: HTMLElement;
  left: number;
  top: number;
  width: number;
  height: number;
  release: number;
  y: number;
  velocity: number;
  falling: boolean;
  supports: Pill[];
};

/** Run a single vertical simulation, with flex layout providing collision-free resting positions. */
function dropPills(tray: HTMLElement, settle: () => void) {
  const mobile = window.matchMedia("(pointer: coarse), (max-width: 639px)").matches;
  const elements = Array.from(tray.querySelectorAll<HTMLElement>("[data-service-pill]"));
  // Taller stacks need more clearance between releases to finish in one pass.
  const launchSpeed = Math.max(elements.length > 5 ? 285 : 20, (tray.clientHeight - 310) / 1.15);
  const bodies = elements.map((element): Pill => ({
    element,
    left: element.offsetLeft,
    top: element.offsetTop,
    width: element.offsetWidth,
    height: element.offsetHeight,
    release: 0,
    y: CEILING,
    velocity: launchSpeed,
    falling: false,
    supports: [],
  })).sort((a, b) => b.top - a.top || a.left - b.left);

  // Release the lowest row first so later pills can land on it.
  bodies.forEach((pill, index) => {
    const stagger = Math.min(0.23, 0.7 / Math.max(1, bodies.length - 1));
    pill.release = 0.17 + index * stagger;
    pill.supports = bodies.slice(0, index).filter((other) => other.top > pill.top &&
      pill.left < other.left + other.width && other.left < pill.left + pill.width);
  });

  let elapsed = 0;
  const clock = { time: 0 };
  const gravity = mobile ? 1550 : 1180;
  const bounce = mobile ? 0.2 : 0.29;
  const tween = gsap.to(clock, {
    time: DURATION,
    duration: DURATION,
    ease: "none",
    onUpdate: () => {
      while (elapsed + STEP <= clock.time) {
        elapsed += STEP;
        for (const pill of bodies) {
          let floor = pill.top;
          let floorVelocity = 0;
          for (const lower of pill.supports) {
            const limit = lower.y - pill.height - CLEARANCE;
            if (lower.falling && limit < floor) {
              floor = limit;
              floorVelocity = lower.velocity;
            }
          }
          if (!pill.falling) {
            if (elapsed < pill.release || floor < CEILING + launchSpeed * STEP || pill.supports.some((lower) => !lower.falling)) continue;
            pill.falling = true;
          }
          pill.velocity += gravity * STEP;
          const next = pill.y + pill.velocity * STEP;
          if (next >= floor) {
            const speed = Math.max(0, pill.velocity - floorVelocity);
            pill.velocity = speed > 30 ? Math.max(-165, floorVelocity - speed * bounce) : floorVelocity;
          }
          pill.y = Math.max(CEILING, Math.min(next, floor));
        }
      }
      for (const pill of bodies) {
        if (!pill.falling) continue;
        pill.element.style.opacity = "1";
        pill.element.style.transform = `translate3d(0, ${(pill.y - pill.top).toFixed(2)}px, 0)`;
      }
    },
    onComplete: settle,
  });

  const width = tray.clientWidth;
  const height = tray.clientHeight;
  const resize = new ResizeObserver(() => {
    if (tray.clientWidth !== width || tray.clientHeight !== height || bodies.some(({ element, left, top, width, height }) =>
      element.offsetLeft !== left || element.offsetTop !== top || element.offsetWidth !== width || element.offsetHeight !== height)) settle();
  });
  resize.observe(tray);
  elements.forEach((element) => resize.observe(element));
  return () => {
    tween.kill();
    resize.disconnect();
    for (const element of elements) {
      element.style.removeProperty("opacity");
      element.style.removeProperty("transform");
    }
  };
}

export function observeBasketDrop(tray: HTMLElement, onPlayed: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches || !window.IntersectionObserver || !window.ResizeObserver) {
    onPlayed();
    return;
  }

  let stop: (() => void) | undefined;
  let active = true;
  function cleanup() {
    if (!active) return;
    active = false;
    observer.disconnect();
    stop?.();
    delete tray.dataset.drop;
    preference.removeEventListener("change", onPreferenceChange);
  }
  function settle() {
    onPlayed();
    cleanup();
  }
  function onPreferenceChange() {
    if (preference.matches) settle();
  }

  const observer = new IntersectionObserver(([entry]) => {
    if (!active) return;
    if (entry.isIntersecting && !stop) {
      onPlayed();
      tray.dataset.drop = "playing";
      stop = dropPills(tray, settle);
    } else if (!entry.isIntersecting && stop) {
      settle();
    }
  }, { rootMargin: "0px 0px -16px", threshold: 0.1 });

  tray.dataset.drop = "pending";
  observer.observe(tray);
  preference.addEventListener("change", onPreferenceChange);
  return cleanup;
}
