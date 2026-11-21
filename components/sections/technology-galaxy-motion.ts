const DURATION = 1500;
const TAU = Math.PI * 2;
const easeOut = (value: number) => 1 - (1 - value) ** 3;

export function orbitRadius(index: number, count: number) {
  return count === 1 ? 32 : 44 - 13 * (count - 1 - index);
}

export function orbitPosition(radius: number, angle: number) {
  return [radius * Math.cos(angle), radius * Math.sin(angle)] as const;
}

export function startGalaxyMotion(stage: HTMLElement, entrance: { current: boolean }) {
  const desktop = matchMedia("(min-width: 48rem)");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const rings = Array.from(stage.querySelectorAll<HTMLElement>("[data-galaxy-ring]"), (ring, index) => ({
    category: ring.dataset.galaxyRing,
    radius: Number(ring.dataset.radius),
    velocity: (index % 2 ? -1 : 1) * TAU / (52_000 + index * 14_000),
    phase: 0,
    speed: 1,
    nodes: Array.from(ring.querySelectorAll<HTMLElement>("[data-angle]"), (node) => ({
      element: node,
      angle: Number(node.dataset.angle),
      delay: Number(node.dataset.delay),
      origin: orbitPosition(Number(ring.dataset.radius), Number(node.dataset.angle)),
    })),
  }));

  let width = stage.clientWidth;
  let height = stage.clientHeight;
  let visible = false;
  let frame = 0;
  let previous = 0;
  let elapsed = entrance.current ? DURATION : 0;

  function paint() {
    for (const ring of rings) {
      for (const { element, angle, delay, origin: [startX, startY] } of ring.nodes) {
        const progress = easeOut(Math.min(1, Math.max(0, (elapsed - delay) / 990)));
        const [x, y] = orbitPosition(ring.radius, angle + ring.phase);
        const dx = (x * progress - startX) * width / 100;
        const dy = (y * progress - startY) * height / 100;
        element.style.transform = `translate3d(${dx}px,${dy}px,0) scale(${0.7 + progress * 0.3})`;
        element.style.opacity = String(Math.min(1, progress * 2.5));
      }
    }
  }

  function tick(now: number) {
    const delta = previous ? Math.min(now - previous, 40) : 0;
    previous = now;
    elapsed = Math.min(DURATION, elapsed + delta);
    if (elapsed === DURATION) {
      for (const ring of rings) {
        const target = stage.dataset.activeRing === ring.category ? 0 : 1;
        ring.speed += (target - ring.speed) * Math.min(1, delta / 90);
        if (Math.abs(target - ring.speed) < 0.01) ring.speed = target;
        ring.phase = (ring.phase + delta * ring.speed * ring.velocity) % TAU;
      }
    }
    paint();
    frame = requestAnimationFrame(tick);
  }

  function sync() {
    cancelAnimationFrame(frame);
    previous = 0;
    const staticLayout = !desktop.matches || reduced.matches;
    const paused = stage.dataset.paused === "true";
    const running = visible && !document.hidden && !staticLayout && !paused;
    if (running && elapsed < DURATION && !entrance.current) {
      entrance.current = true;
      stage.dataset.entering = "true";
      paint();
    }
    stage.dataset.running = String(running);
    if (staticLayout || paused) {
      elapsed = DURATION;
      delete stage.dataset.entering;
      paint();
    }
    if (running) frame = requestAnimationFrame(tick);
  }

  const resize = new ResizeObserver(([entry]) => {
    width = entry.contentRect.width;
    height = entry.contentRect.height;
    if (elapsed === DURATION) paint();
  });
  resize.observe(stage);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, { threshold: 0.15 });
  visibility.observe(stage);
  const controls = new MutationObserver(sync);
  controls.observe(stage, { attributes: true, attributeFilter: ["data-paused"] });
  desktop.addEventListener("change", sync);
  reduced.addEventListener("change", sync);
  document.addEventListener("visibilitychange", sync);
  sync();

  return () => {
    cancelAnimationFrame(frame);
    visibility.disconnect();
    resize.disconnect();
    controls.disconnect();
    desktop.removeEventListener("change", sync);
    reduced.removeEventListener("change", sync);
    document.removeEventListener("visibilitychange", sync);
  };
}
