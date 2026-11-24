const SPEED = 40;
const FOOTER_PAUSE = 1500;
const IDLE = 950;

export function startPreviewScroll(area: HTMLDivElement, image: HTMLImageElement, allowShortImage: boolean, onRange: (scrollable: boolean) => void, initiallyPaused: boolean) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const frameElement = area.closest<HTMLElement>("[data-kind]") ?? area;
  let distance = 0;
  let position = area.scrollTop;
  let written = position;
  let phase: "down" | "hold" | "return" = "down";
  let phaseTime = 0;
  let returnFrom = 0;
  let hovered = frameElement.matches(":hover") && matchMedia("(hover: hover)").matches;
  let focused = area.contains(document.activeElement);
  let touching = false;
  let visible = false;
  let paused = initiallyPaused;
  let idleTimer = 0;
  let raf = 0;
  let previousTime = 0;

  function write(next: number) {
    position = next;
    area.scrollTop = next;
    written = area.scrollTop;
  }

  function sync() {
    const shouldRun = distance > 0 && visible && !document.hidden && !reduced.matches
      && !hovered && !focused && !touching && !idleTimer && !paused;
    if (shouldRun) {
      if (!raf) raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      previousTime = 0;
    }
  }

  function tick(now: number) {
    raf = 0;
    const delta = previousTime ? Math.min(64, now - previousTime) : 0;
    previousTime = now;

    if (phase === "down") {
      write(Math.min(distance, position + SPEED * delta / 1000));
      if (position >= distance) {
        phase = "hold";
        phaseTime = 0;
      }
    } else if (phase === "hold") {
      phaseTime += delta;
      if (phaseTime >= FOOTER_PAUSE) {
        phase = "return";
        returnFrom = position;
        phaseTime = 0;
      }
    } else {
      phaseTime += delta;
      const progress = Math.min(1, phaseTime / Math.max(850, Math.min(2600, returnFrom * 2)));
      const smooth = progress * progress * (3 - 2 * progress);
      write(returnFrom * (1 - smooth));
      if (progress === 1) phase = "down";
    }
    sync();
  }

  function idle() {
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => { idleTimer = 0; sync(); }, IDLE);
    sync();
  }

  function onScroll() {
    const current = area.scrollTop;
    if (Math.abs(current - written) < 1) return;
    written = position = current;
    phase = "down";
    phaseTime = 0;
    idle();
  }

  function measure() {
    const eligible = allowShortImage || image.naturalHeight > image.naturalWidth;
    const next = eligible ? Math.max(0, area.scrollHeight - area.clientHeight) : 0;
    if (distance !== next) {
      distance = next;
      write(Math.min(position, distance));
      phase = "down";
      phaseTime = 0;
    }
    onRange(distance > 1);
    sync();
  }

  function enter(event: PointerEvent) {
    if (event.pointerType === "mouse" || event.pointerType === "pen") {
      hovered = true;
      sync();
    }
  }

  function leave(event: PointerEvent) {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    hovered = false;
    window.clearTimeout(idleTimer);
    idleTimer = 0;
    sync();
  }

  function touchStart(event: PointerEvent) {
    if (event.pointerType !== "touch") return;
    touching = true;
    sync();
  }

  function touchEnd(event: PointerEvent) {
    if (event.pointerType !== "touch" || !touching) return;
    touching = false;
    idle();
  }

  const focus = () => { focused = true; sync(); };
  const blur = () => { focused = false; sync(); };
  const resize = new ResizeObserver(measure);
  resize.observe(area);
  resize.observe(image);
  const observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting && entry.intersectionRatio >= 0.5;
    sync();
  }, { threshold: [0, 0.5] });
  observer.observe(area);

  area.addEventListener("scroll", onScroll, { passive: true });
  area.addEventListener("wheel", idle, { passive: true });
  area.addEventListener("focusin", focus);
  area.addEventListener("focusout", blur);
  area.addEventListener("pointerdown", touchStart);
  frameElement.addEventListener("pointerenter", enter);
  frameElement.addEventListener("pointerleave", leave);
  window.addEventListener("pointerup", touchEnd);
  window.addEventListener("pointercancel", touchEnd);
  document.addEventListener("visibilitychange", sync);
  reduced.addEventListener("change", sync);
  measure();

  return {
    setPaused(value: boolean) { paused = value; sync(); },
    dispose() {
      cancelAnimationFrame(raf);
      window.clearTimeout(idleTimer);
      observer.disconnect();
      resize.disconnect();
      area.removeEventListener("scroll", onScroll);
      area.removeEventListener("wheel", idle);
      area.removeEventListener("focusin", focus);
      area.removeEventListener("focusout", blur);
      area.removeEventListener("pointerdown", touchStart);
      frameElement.removeEventListener("pointerenter", enter);
      frameElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerup", touchEnd);
      window.removeEventListener("pointercancel", touchEnd);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
    },
  };
}
