// Pointer-drag tracking shared by the 404 page's falling letters and photo pile. One call follows a single pointer from pointerdown to release, and every listener it adds is removed together when the drag ends.

export interface Drag {
  /** Distance moved since the drag started, in px. */
  dx: number;
  dy: number;
  /** Smoothed velocity in px per second. */
  vx: number;
  vy: number;
  /** Milliseconds since the pointer last moved. */
  idle: number;
  /** True when the browser took the gesture away (a scroll started, or the pointer capture was lost). */
  cancelled: boolean;
}

interface Handlers {
  onMove(drag: Drag, event: PointerEvent): void;
  onEnd(drag: Drag): void;
}

/** A pause this long before letting go means the thing was put down, not thrown. */
export const STILL_MS = 80;
export const isStill = (drag: Drag) => drag.idle > STILL_MS;

/** Returns false (and does nothing) for anything but the primary pointer's main button, so a second finger or a right click never starts a second drag. */
export function startDrag(el: HTMLElement, start: PointerEvent, { onMove, onEnd }: Handlers): boolean {
  if (start.button !== 0 || !start.isPrimary) return false;

  const abort = new AbortController();
  const { signal } = abort;
  const drag: Drag = { dx: 0, dy: 0, vx: 0, vy: 0, idle: 0, cancelled: false };
  let lastX = start.clientX;
  let lastY = start.clientY;
  let lastT = performance.now();
  el.setPointerCapture(start.pointerId);

  const mine = (e: PointerEvent) => e.pointerId === start.pointerId;
  const end = (e: PointerEvent, cancelled: boolean) => {
    if (!mine(e)) return;
    abort.abort();
    if (el.hasPointerCapture(start.pointerId)) el.releasePointerCapture(start.pointerId);
    drag.idle = performance.now() - lastT;
    drag.cancelled = cancelled;
    onEnd(drag);
  };

  el.addEventListener(
    'pointermove',
    (e) => {
      if (!mine(e)) return;
      const now = performance.now();
      const dt = Math.max(now - lastT, 1) / 1000;
      drag.dx = e.clientX - start.clientX;
      drag.dy = e.clientY - start.clientY;
      drag.vx = drag.vx * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
      drag.vy = drag.vy * 0.6 + ((e.clientY - lastY) / dt) * 0.4;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
      onMove(drag, e);
    },
    { signal },
  );
  el.addEventListener('pointerup', (e) => end(e, false), { signal });
  el.addEventListener('pointercancel', (e) => end(e, true), { signal });
  el.addEventListener('lostpointercapture', (e) => end(e, true), { signal });
  return true;
}
