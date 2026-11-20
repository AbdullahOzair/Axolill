type Point = { x: number; y: number };
type Circle = Point & { radius: number };

const GAP = 2;
const DRAG_THRESHOLD = 5;

export function enableBasketDrag(tray: HTMLElement) {
  let drag: {
    pointerId: number;
    ball: HTMLElement;
    pointer: Point;
    origin: Circle;
    offset: Point;
    position: Point;
    bounds: DOMRect;
    neighbors: Circle[];
    moving: boolean;
  } | undefined;
  const moved = new Set<HTMLElement>();

  function measure(ball: HTMLElement): Circle {
    const rect = ball.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width / 2 };
  }

  function onDown(event: PointerEvent) {
    if (drag) return;
    if (event.button !== 0 || event.pointerType === "touch" || tray.dataset.drop ||
      event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const ball = event.target instanceof Element && event.target.closest<HTMLElement>("[data-service-pill]");
    if (!ball || !tray.contains(ball)) return;
    const origin = measure(ball);
    drag = {
      pointerId: event.pointerId,
      ball,
      pointer: { x: event.clientX, y: event.clientY },
      origin,
      offset: { x: parseFloat(ball.style.getPropertyValue("--ball-x")) || 0, y: parseFloat(ball.style.getPropertyValue("--ball-y")) || 0 },
      position: { x: origin.x, y: origin.y },
      bounds: tray.getBoundingClientRect(),
      neighbors: Array.from(tray.querySelectorAll<HTMLElement>("[data-service-pill]"))
        .filter((other) => other !== ball).map(measure),
      moving: false,
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    window.addEventListener("scroll", stop, true);
  }

  function onMove(event: PointerEvent) {
    const current = drag;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.pointer.x;
    const dy = event.clientY - current.pointer.y;
    if (!current.moving) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      tray.setPointerCapture(event.pointerId);
      current.moving = true;
      current.ball.dataset.dragging = "";
    }
    event.preventDefault();
    const { bounds, origin, offset, neighbors, position, ball } = current;
    const inset = origin.radius + GAP;
    const x = Math.min(bounds.right - inset, Math.max(bounds.left + inset, origin.x + dx));
    const y = Math.min(bounds.bottom - inset, Math.max(bounds.top + inset, origin.y + dy));
    const fits = (point: Point) => neighbors.every((other) =>
      Math.hypot(other.x - point.x, other.y - point.y) >= other.radius + inset);
    const next = [{ x, y }, { x, y: position.y }, { x: position.x, y }].find(fits);
    if (!next) return;

    current.position = next;
    ball.style.setProperty("--ball-x", `${offset.x + next.x - origin.x}px`);
    ball.style.setProperty("--ball-y", `${offset.y + next.y - origin.y}px`);
    moved.add(ball);
  }

  function stop() {
    if (!drag) return;
    const { ball, pointerId } = drag;
    drag = undefined;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onEnd);
    window.removeEventListener("pointercancel", onEnd);
    window.removeEventListener("scroll", stop, true);
    delete ball.dataset.dragging;
    if (tray.hasPointerCapture(pointerId)) tray.releasePointerCapture(pointerId);
  }

  function onEnd(event: PointerEvent) {
    if (drag?.pointerId === event.pointerId) stop();
  }

  function reset() {
    stop();
    for (const ball of moved) {
      ball.style.removeProperty("--ball-x");
      ball.style.removeProperty("--ball-y");
    }
    moved.clear();
  }

  const resize = typeof ResizeObserver === "function" ? new ResizeObserver(reset) : null;
  resize?.observe(tray);
  tray.querySelectorAll("[data-service-pill]").forEach((ball) => resize?.observe(ball));
  tray.addEventListener("pointerdown", onDown);
  tray.addEventListener("lostpointercapture", onEnd);
  return () => {
    reset();
    resize?.disconnect();
    tray.removeEventListener("pointerdown", onDown);
    tray.removeEventListener("lostpointercapture", onEnd);
  };
}
