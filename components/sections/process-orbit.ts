import { gsap } from "gsap";

export const HUB = [68, 62] as const;
export const NODES = [[111, 155], [185, 216], [271, 213], [348, 160], [414, 76], [489, 104], [550, 172]] as const;
export const ORBIT_PATH = [HUB, ...NODES].reduce((path, [x, y], index, points) => {
  if (index === 0) return `M ${x} ${y}`;
  const [previousX, previousY] = points[index - 1];
  const bend = (x - previousX) * 0.55;
  return `${path} C ${previousX + bend} ${previousY}, ${x - bend} ${y}, ${x} ${y}`;
}, "");

const STAGES_START = 0.19;
const OPEN_DURATION = 1.5;
const COLLAPSE_AT = 0.86;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const smooth = (n: number) => n * n * (3 - 2 * n);
const stagePosition = (progress: number) => clamp((progress - STAGES_START) / (COLLAPSE_AT - STAGES_START)) * NODES.length;

export function mountProcessOrbit(track: HTMLElement, stage: HTMLElement, onExpanded: (expanded: boolean) => void, onStage: (stage: number) => void) {
  const diagram = stage.querySelector<HTMLElement>("[data-process-diagram]")!;
  const hub = stage.querySelector<HTMLElement>("[data-process-hub]")!;
  const path = stage.querySelector<SVGPathElement>("[data-process-progress]")!;
  const gears = track.closest("section")?.querySelector<HTMLElement>("[data-process-gears]");
  const nodes = Array.from(stage.querySelectorAll<HTMLElement>("[data-process-node]"));
  const compact = window.matchMedia("(max-height: 359px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const entrance = { value: 0 };
  let opening: gsap.core.Tween | undefined;
  let stageInView = false;
  let opened = false;
  let progress = 0;
  let active = 0;
  let frame = 0;
  let manualStage = false;
  let lastY = window.scrollY;
  let travel = 1;
  let pinTop = 0;
  let center = { x: 0, y: 0 };
  let destination = center;
  let endpoints: typeof center[] = [];
  let stops: number[] = [];

  function select(index: number) {
    if (index !== active) {
      active = index;
      stage.dataset.active = String(index);
      onStage(index);
    }
  }

  function paint() {
    const closing = reducedMotion.matches
      ? Number(progress > COLLAPSE_AT)
      : smooth(clamp((progress - COLLAPSE_AT) / (1 - COLLAPSE_AT)));
    const openness = entrance.value * (1 - closing);
    const hubMotion = smooth(clamp(openness / 0.85));
    const x = (destination.x - center.x) * hubMotion;
    const y = (destination.y - center.y) * hubMotion;
    hub.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 - 0.45 * hubMotion})`;
    const originX = center.x + x;
    const originY = center.y + y;

    nodes.forEach((node, index) => {
      const point = endpoints[index];
      const t = smooth(clamp((openness - 0.14 - index * 0.035) / 0.61));
      const arch = 4 * t * (1 - t) * (18 + index * 2);
      node.style.transform = `translate3d(${originX + (point.x - originX) * t}px,${originY + (point.y - originY) * t - arch}px,0) scale(${0.55 + 0.45 * t})`;
      node.style.opacity = String(clamp(t * 2));
    });
    stage.style.setProperty("--process-open", String(clamp((openness - 0.29) / 0.71)));
    const position = stagePosition(progress);
    const index = Math.min(NODES.length - 1, Math.floor(position));
    const current = stops[index + 1];
    const upcoming = stops[Math.min(index + 2, NODES.length)];
    const interpolatePath = !manualStage && !reducedMotion.matches;
    const drawn = interpolatePath ? current + (upcoming - current) * (position - index) : stops[active + 1];
    path.style.strokeDasharray = `${drawn * openness} 1`;

    const nextOpened = openness > 0.64;
    if (nextOpened !== opened) {
      if (!nextOpened && stage.contains(document.activeElement) && document.activeElement !== hub) hub.focus({ preventScroll: true });
      opened = nextOpened;
      onExpanded(opened);
    }
  }

  function openInView() {
    if (!stageInView || compact.matches || progress >= COLLAPSE_AT || opening || entrance.value > 0) return;
    if (reducedMotion.matches) {
      entrance.value = 1;
      return;
    }
    opening = gsap.to(entrance, { value: 1, duration: OPEN_DURATION, ease: "power2.inOut", onUpdate: paint });
  }

  function resetEntrance() {
    opening?.kill();
    opening = undefined;
    entrance.value = 0;
  }

  function readScroll(force = false) {
    frame = 0;
    if (compact.matches) return;
    const moved = window.scrollY !== lastY;
    if (moved) manualStage = false;
    lastY = window.scrollY;
    const next = clamp((pinTop - track.getBoundingClientRect().top) / travel);
    const nextIndex = Math.min(NODES.length - 1, Math.floor(stagePosition(next)));
    if (!force && next === progress && (manualStage || active === nextIndex)) return;
    progress = next;
    if (!manualStage) select(nextIndex);
    openInView();
    paint();
  }

  function measure() {
    if (compact.matches) return;
    center = { x: stage.clientWidth / 2, y: stage.clientHeight / 2 };
    const point = ([x, y]: readonly [number, number]) => ({
      x: diagram.offsetLeft + x / 600 * diagram.clientWidth,
      y: diagram.offsetTop + y / 280 * diagram.clientHeight,
    });
    destination = point(HUB);
    endpoints = NODES.map(point);
    travel = Math.max(1, track.offsetHeight - stage.offsetHeight);
    pinTop = parseFloat(getComputedStyle(stage).top) || 0;

    // Map each node to arc length so progress meets the unevenly spaced stages.
    const length = path.getTotalLength();
    stops = [0, ...NODES.map(([x], index) => {
      if (index === NODES.length - 1) return 1;
      let low = 0;
      let high = length;
      for (let i = 0; i < 15; i++) {
        const mid = (low + high) / 2;
        if (path.getPointAtLength(mid).x < x) low = mid;
        else high = mid;
      }
      return high / length;
    })];
    readScroll(true);
  }

  function scheduleScroll() {
    if (!compact.matches && !frame) frame = requestAnimationFrame(() => readScroll());
  }

  function onHeightModeChange() {
    resetEntrance();
    progress = 0;
    manualStage = opened = false;
    onExpanded(false);
    select(0);
    if (!compact.matches) measure();
  }

  function onMotionPreferenceChange() {
    if (reducedMotion.matches && opening) {
      resetEntrance();
      entrance.value = 1;
    }
    readScroll(true);
  }

  const size = new ResizeObserver(measure);
  size.observe(stage);
  size.observe(diagram);
  const visibility = new IntersectionObserver(([entry]) => {
    if (gears) gears.dataset.processVisible = String(entry.isIntersecting);
  });
  if (gears) visibility.observe(gears);
  const entryObserver = new IntersectionObserver(([entry]) => {
    stageInView = entry.intersectionRatio >= 0.6;
    if (!entry.isIntersecting) resetEntrance();
    readScroll(true);
  }, { threshold: [0, 0.6] });
  entryObserver.observe(stage);
  compact.addEventListener("change", onHeightModeChange);
  reducedMotion.addEventListener("change", onMotionPreferenceChange);
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  measure();

  return {
    choose(index: number) {
      if (!opened) return;
      manualStage = true;
      lastY = window.scrollY;
      select(index);
      paint();
    },
    dispose() {
      cancelAnimationFrame(frame);
      resetEntrance();
      size.disconnect();
      visibility.disconnect();
      entryObserver.disconnect();
      compact.removeEventListener("change", onHeightModeChange);
      reducedMotion.removeEventListener("change", onMotionPreferenceChange);
      window.removeEventListener("scroll", scheduleScroll);
    },
  };
}
