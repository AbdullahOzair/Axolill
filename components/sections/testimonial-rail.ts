const PIXELS_PER_SECOND = 32;
const ARROW_DURATION = 320;

/** Move a native scroll viewport across identical groups, wrapping at a visually identical offset. */
export function mountTestimonialRail(carousel: HTMLElement, viewport: HTMLElement) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const first = viewport.querySelector<HTMLElement>("[data-testimonial-group]");
  const second = first?.nextElementSibling as HTMLElement | null;
  if (!first || !second) return;

  let cycle = 0;
  let step = 0;
  let offset = 0;
  let applied = 0;
  let frame = 0;
  let lastTime = 0;
  let manual: { from: number; distance: number; start: number } | undefined;
  let visible = false;
  let hovering = carousel.matches(":hover") && window.matchMedia("(hover: hover)").matches;
  let keyboardFocus = false;
  let touching = false;
  let drag: { pointerId: number; x: number; from: number } | undefined;
  let paused = false;
  let scrolling = false;
  let scrollTimer = 0;

  function write(value: number) {
    if (!cycle) return;
    offset = cycle + ((value % cycle) + cycle) % cycle;
    viewport.scrollLeft = offset;
    applied = viewport.scrollLeft;
  }

  function canPlay() {
    return cycle > 0 && visible && !document.hidden && !hovering && !keyboardFocus && !touching && !drag &&
      !paused && !scrolling && !preference.matches;
  }

  function refresh() {
    if (!manual && !canPlay()) {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
    } else if (!frame) {
      frame = requestAnimationFrame(tick);
    }
  }

  function tick(time: number) {
    frame = 0;
    if (manual) {
      const progress = Math.min((time - manual.start) / ARROW_DURATION, 1);
      write(manual.from + manual.distance * (1 - (1 - progress) ** 3));
      if (progress === 1) manual = undefined;
    } else if (canPlay() && lastTime) {
      write(offset + PIXELS_PER_SECOND * Math.min(time - lastTime, 34) / 1000);
    }
    lastTime = time;
    refresh();
  }

  function measure() {
    const before = cycle;
    cycle = second!.offsetLeft - first!.offsetLeft;
    step = first!.children[1].getBoundingClientRect().left - first!.children[0].getBoundingClientRect().left;
    if (before !== cycle) {
      manual = undefined;
      write(before ? offset * cycle / before : cycle);
    }
    refresh();
  }

  function onScroll() {
    if (Math.abs(viewport.scrollLeft - applied) < 1) return;
    offset = viewport.scrollLeft;
    manual = undefined;
    scrolling = true;
    clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      scrolling = false;
      if (!touching) write(offset);
      refresh();
    }, 180);
    refresh();
  }

  function onEnter(event: PointerEvent) {
    if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
    hovering = true;
    refresh();
  }
  function onLeave() { hovering = false; refresh(); }
  function onDown(event: PointerEvent) {
    if (event.pointerType === "touch") touching = true;
    else if (event.button === 0) drag = { pointerId: event.pointerId, x: event.clientX, from: offset };
    else return;
    manual = undefined;
    refresh();
  }
  function onMove(event: PointerEvent) {
    if (!drag || drag.pointerId !== event.pointerId || Math.abs(event.clientX - drag.x) < 4 && !viewport.dataset.dragging) return;
    if (!viewport.hasPointerCapture(event.pointerId)) viewport.setPointerCapture(event.pointerId);
    viewport.dataset.dragging = "true";
    event.preventDefault();
    write(drag.from + drag.x - event.clientX);
  }
  function onUp(event: PointerEvent) {
    if (event.pointerType === "touch") touching = false;
    if (drag?.pointerId === event.pointerId) {
      drag = undefined;
      delete viewport.dataset.dragging;
      if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    }
    refresh();
  }
  function onFocus(event: FocusEvent) {
    keyboardFocus = event.target instanceof Element && event.target.matches(":focus-visible");
    refresh();
  }
  function onBlur(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && carousel.contains(event.relatedTarget)) return;
    keyboardFocus = false;
    refresh();
  }
  function onPreference() {
    if (preference.matches) manual = undefined;
    refresh();
  }

  const size = new ResizeObserver(measure);
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); });
  size.observe(viewport);
  size.observe(first);
  intersection.observe(viewport);
  measure();
  carousel.addEventListener("pointerenter", onEnter);
  carousel.addEventListener("pointerleave", onLeave);
  carousel.addEventListener("focusin", onFocus);
  carousel.addEventListener("focusout", onBlur);
  viewport.addEventListener("pointerdown", onDown);
  viewport.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  document.addEventListener("visibilitychange", refresh);
  preference.addEventListener("change", onPreference);

  return {
    setPaused(value: boolean) { paused = value; refresh(); },
    move(direction: number) {
      if (preference.matches) write(offset + direction * step);
      else manual = { from: offset, distance: direction * step, start: performance.now() };
      refresh();
    },
    dispose() {
      cancelAnimationFrame(frame);
      clearTimeout(scrollTimer);
      size.disconnect();
      intersection.disconnect();
      carousel.removeEventListener("pointerenter", onEnter);
      carousel.removeEventListener("pointerleave", onLeave);
      carousel.removeEventListener("focusin", onFocus);
      carousel.removeEventListener("focusout", onBlur);
      viewport.removeEventListener("pointerdown", onDown);
      viewport.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("visibilitychange", refresh);
      preference.removeEventListener("change", onPreference);
    },
  };
}
