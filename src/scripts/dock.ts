// Moving and resizing the minimised chat (the dock). Loaded with chat.ts, so it never costs a page that does not use the chat.
// The geometry is the distance from the right and bottom edge plus the size, in px, kept in localStorage ('chat:dock') and
// applied as --s-r, --s-b, --s-w and --s-h on <html> (also by the head script in Layout.astro before the first paint).
// CSS (ChatHost.astro) clamps those values to the window, so nothing here reacts to a window resize. Only a gesture writes them.
import { startDrag } from './drag';

const KEY = 'chat:dock';
const KEYS = ['r', 'b', 'w', 'h'] as const;
type Key = (typeof KEYS)[number];
type Geo = Partial<Record<Key, number>>;
type Edge = 'n' | 'w' | 'nw';

const root = document.documentElement;
// The phone's one-line bar and a short window keep the default dock.
const roomy = matchMedia('(min-width: 40.0625rem) and (min-height: 34rem)');
const rem = () => parseFloat(getComputedStyle(root).fontSize) || 16;
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

function read(): Geo {
  const geo: Geo = {};
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    for (const key of KEYS) if (typeof saved?.[key] === 'number' && isFinite(saved[key])) geo[key] = saved[key];
  } catch {
    // Storage can be blocked or hold something else: the dock then keeps its default place.
  }
  return geo;
}

function paint(geo: Geo) {
  let custom = false;
  for (const key of KEYS) {
    const value = geo[key];
    if (value === undefined) root.style.removeProperty(`--s-${key}`);
    else {
      root.style.setProperty(`--s-${key}`, `${value}px`);
      custom = true;
    }
  }
  root.toggleAttribute('data-dock-custom', custom);
}

function write(geo: Geo) {
  try {
    if (Object.keys(geo).length) localStorage.setItem(KEY, JSON.stringify(geo));
    else localStorage.removeItem(KEY);
  } catch {
    // The layout then lasts until the page changes.
  }
  paint(geo);
}

/** Apply what is saved (the page may be older than the saved layout, for example after the back button). */
export function applyDock() {
  paint(read());
}

/** Back to the default place and size. The dock glides there, because the transition stays on. */
export function resetDock() {
  write({});
}

const CURSORS: Record<Edge | 'move', string> = { move: 'grabbing', n: 'ns-resize', w: 'ew-resize', nw: 'nwse-resize' };

/** Adds the three resize handles and the header drag. `resized` runs after a resize, so the text box and the log can catch up. */
export function attachDock(panel: HTMLElement, resized: () => void) {
  const head = panel.querySelector<HTMLElement>('.chat-head')!;

  function gesture(event: PointerEvent, target: HTMLElement, kind: Edge | 'move') {
    if (root.dataset.chat !== 'dock' || !roomy.matches) return;
    const rect = panel.getBoundingClientRect();
    const unit = rem();
    const margin = unit / 2;
    const width = root.clientWidth;
    const height = innerHeight;
    // Start from what is on screen, not from what is saved: CSS may have clamped it.
    const from = { r: width - rect.right, b: height - rect.bottom, w: rect.width, h: rect.height };
    const next = { ...from };
    const threshold = kind === 'move' ? (event.pointerType === 'touch' ? 8 : 5) : 2;
    let moved = false;
    let frame = 0;

    const show = () => {
      frame = 0;
      paint(kind === 'move' ? { ...read(), r: next.r, b: next.b } : next);
    };

    const started = startDrag(target, event, {
      onMove({ dx, dy }) {
        if (!moved) {
          if (Math.hypot(dx, dy) < threshold) return;
          moved = true;
          root.classList.add('chat-dragging');
          root.style.setProperty('--drag-cursor', CURSORS[kind]);
        }
        if (kind === 'move') {
          next.r = clamp(from.r - dx, margin, width - from.w - margin);
          next.b = clamp(from.b - dy, margin, height - from.h - margin);
          // A light pull to the default corner, so it is easy to find again.
          if (Math.abs(next.r - unit) < 12) next.r = unit;
          if (Math.abs(next.b - unit) < 12) next.b = unit;
        } else {
          if (kind.includes('w')) next.w = clamp(from.w - dx, 21 * unit, Math.min(40 * unit, width - from.r - margin));
          if (kind.includes('n')) next.h = clamp(from.h - dy, 20 * unit, height - from.b - margin);
        }
        frame ||= requestAnimationFrame(show);
      },
      onEnd() {
        cancelAnimationFrame(frame);
        root.classList.remove('chat-dragging');
        root.style.removeProperty('--drag-cursor');
        if (!moved) return;
        // The click that ends a drag must not expand the chat (the header handles clicks).
        const swallow = (click: Event) => click.stopPropagation();
        addEventListener('click', swallow, { capture: true, once: true });
        setTimeout(() => removeEventListener('click', swallow, true), 100);
        if (kind === 'move') {
          // Only the place is saved, so a dock of the default size keeps following the default.
          const geo: Geo = { ...read(), r: Math.round(next.r), b: Math.round(next.b) };
          if (geo.r === Math.round(unit)) delete geo.r;
          if (geo.b === Math.round(unit)) delete geo.b;
          write(geo);
        } else {
          write({ r: Math.round(next.r), b: Math.round(next.b), w: Math.round(next.w), h: Math.round(next.h) });
          resized();
        }
      },
    });
    if (started) event.preventDefault();
  }

  head.addEventListener('pointerdown', (event) => {
    if ((event.target as Element).closest('button')) return;
    gesture(event, head, 'move');
  });

  for (const edge of ['n', 'w', 'nw'] as const) {
    const handle = document.createElement('div');
    handle.className = `chat-h chat-h-${edge}`;
    handle.setAttribute('aria-hidden', 'true');
    handle.addEventListener('pointerdown', (event) => gesture(event, handle, edge));
    handle.addEventListener('dblclick', () => resetDock());
    panel.append(handle);
  }
}
