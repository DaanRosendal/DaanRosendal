// The photo pile on the 404 page. The photos are dealt in with a spring, the top one tilts in 3D with a glare that follows the cursor, and it flicks away to the side and tucks under the pile. The pile advances on its own, on tap or click, with the arrow keys, or by dragging the top photo away in any direction. A button fans all the photos out in an arc, and a soft glow behind the pile takes the colors of the current photo (sampled at build time into `data-glow`).

import { startDrag, isStill } from './drag';

const SHOWN = 4; // photos visible in the pile
const AUTO_MS = 3400; // time between automatic flicks
const FLICK_MS = 450; // the top photo swinging out to the side
const TUCK_AT = 0.7; // fraction of the flick after which the photo turns back, so it never stops dead at the side
const RETURN_MS = 700; // the photo sliding back in underneath the pile
const SPRING_MS = 900; // how long the card spring in 404.astro takes to settle
const DEAL_WAIT_MS = 120; // pause before the photos are dealt in
const DEAL_STAGGER_MS = 140; // gap between the photos being dealt
const PERSPECTIVE = 900; // px, for the 3D tilt
const TAP_SLOP = 6; // px of movement that still counts as a tap
const FLICK_DISTANCE = 90; // px of dragging that sends the photo away
const FLICK_SPEED = 600; // px per second of fling that sends the photo away
const FAN_WIDTH = 2.9; // the open fan is this many photo-widths wide
const FAN_MAX_SCALE = 0.86;

const LABEL_PILE = 'Photos of my cat. Press Enter or the arrow keys for the next one.';
const LABEL_FAN = 'Photos of my cat, fanned out. Pick one, or press Escape to close the fan.';

type Mode = 'dealing' | 'idle' | 'flicking' | 'dragging' | 'fanned';
type Access = 'top' | 'hidden' | 'pick';

interface Card {
  el: HTMLElement;
  index: number;
  rot: number; // resting tilt in degrees
  x: number; // resting offset in px
}

export interface CatStackParts {
  stack: HTMLElement;
  counter: HTMLElement | null;
  fanButton: HTMLElement | null;
  glow: HTMLElement | null;
  /** A visually hidden live region that tells screen readers which photo is on top after a manual change. */
  status: HTMLElement | null;
}

const randomDir = () => (Math.random() < 0.5 ? -1 : 1);
const unit = (x: number, y: number): [number, number] => {
  const len = Math.hypot(x, y) || 1;
  return [x / len, y / len];
};

export function catStack({ stack, counter, fanButton, glow, status }: CatStackParts) {
  // Every photo has its own small tilt and offset, so the pile looks hand-dropped.
  const cards: Card[] = [...stack.querySelectorAll<HTMLElement>('[data-card]')].map((el, index) => ({
    el,
    index,
    rot: (Math.random() - 0.5) * 12,
    x: (Math.random() - 0.5) * 14,
  }));
  const n = cards.length;
  if (n < 2) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layers = glow ? [...glow.children].filter((c): c is HTMLElement => c instanceof HTMLElement) : [];
  let order = [...cards]; // top photo first
  let tucked: Card | null = null; // the photo that just went under the pile stays visible there
  let mode: Mode = 'dealing';
  let hovering = false;
  let layer = 0;
  let timer = 0;

  stack.tabIndex = 0; // only with JavaScript, because without it the pile has nothing to do
  stack.setAttribute('aria-label', LABEL_PILE);

  const altOf = (c: Card) => c.el.querySelector('img')?.alt ?? '';
  const announce = () => {
    if (status) status.textContent = altOf(order[0]);
  };

  const rest = (c: Card, depth: number) => {
    const lift = Math.min(depth, SHOWN - 1);
    const rot = depth === 0 ? c.rot * 0.35 : c.rot;
    return `translate(${(c.x * (depth ? 1 : 0.3)).toFixed(1)}px, ${(-lift * 7).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${(1 - lift * 0.045).toFixed(3)})`;
  };

  /** Sets what a card is for assistive tech and clears the inline leftovers of hover and drag. */
  function setAccess(c: Card, access: Access) {
    const { el } = c;
    el.removeAttribute('data-tilt');
    el.style.transition = '';
    el.toggleAttribute('inert', access === 'hidden');
    el.setAttribute('aria-hidden', String(access === 'hidden'));
    if (access === 'pick') {
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', altOf(c));
    } else {
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      el.removeAttribute('aria-label');
    }
  }

  function setGlow() {
    const colors = order[0].el.dataset.glow?.split('|');
    if (layers.length < 2 || !colors || colors.length < 4) return;
    layer = 1 - layer;
    const at = ['25% 25%', '75% 25%', '25% 75%', '75% 75%'];
    layers[layer].style.backgroundImage = colors.map((c, i) => `radial-gradient(circle at ${at[i]}, ${c}, transparent 65%)`).join(', ');
    layers.forEach((l, i) => l.toggleAttribute('data-on', i === layer));
  }

  function render() {
    order.forEach((c, i) => {
      c.el.style.zIndex = String(n - i);
      c.el.style.transform = rest(c, i);
      c.el.style.opacity = i < SHOWN || c === tucked ? '1' : '0';
      setAccess(c, i === 0 ? 'top' : 'hidden');
    });
    if (counter) counter.textContent = `${order[0].index + 1} / ${n}`;
    setGlow();
  }

  function schedule() {
    clearTimeout(timer);
    if (reduced || mode === 'fanned') return;
    timer = window.setTimeout(() => (mode !== 'idle' || document.hidden || hovering ? schedule() : next(randomDir(), 0, false)), AUTO_MS);
  }

  /** Sends the top photo off in the direction (ux, uy), then slides it back in underneath the pile. `manual` is true when the visitor did it, so screen readers are told. */
  function flick(ux: number, uy: number, manual: boolean) {
    mode = 'flicking';
    clearTimeout(timer);
    const [card, ...others] = order;
    order = others;
    tucked = null;
    render(); // the rest of the pile moves up
    const { el } = card;
    // Swing out far enough to clear the whole pile in that direction, so the photo changes layer where nothing overlaps and the swap cannot be seen.
    const reach = Math.max(Math.abs(ux) / (stack.offsetWidth * 1.2 + 28), Math.abs(uy) / (stack.offsetHeight * 1.2 + 28));
    const outX = ux / reach;
    const outY = uy / reach - 20 * (1 - Math.abs(uy)); // a little lift when it leaves sideways
    el.removeAttribute('data-tilt');
    el.style.zIndex = String(n + 1);
    el.style.opacity = '1';
    el.style.transition = reduced ? 'none' : `transform ${FLICK_MS}ms cubic-bezier(0.25, 0.8, 0.3, 1)`;
    el.style.transform = `translate(${outX.toFixed(1)}px, ${outY.toFixed(1)}px) rotate(${(ux * 14).toFixed(1)}deg) scale(1.04)`;
    window.setTimeout(
      () => {
        order.push(card);
        tucked = card;
        render(); // puts the photo underneath the pile, and its transform back to the bottom of the pile
        if (!reduced) {
          el.style.transition = `transform ${RETURN_MS}ms cubic-bezier(0.45, 0, 0.2, 1)`;
          window.setTimeout(() => {
            if (card !== order[0]) el.style.transition = '';
          }, RETURN_MS);
        }
        mode = 'idle';
        if (manual) announce();
        schedule();
      },
      reduced ? 0 : FLICK_MS * TUCK_AT,
    );
  }

  function next(ux: number, uy: number, manual: boolean) {
    if (mode === 'idle') flick(ux, uy, manual);
  }

  // The fan: the photos sit on an arc, like a hand of playing cards.
  function layoutFan() {
    const w = stack.offsetWidth;
    const scale = Math.min(FAN_MAX_SCALE, (innerWidth - 32) / (FAN_WIDTH * w)); // shrinks the fan to fit the window
    const step = ((innerWidth < 560 ? 9 : 11) * Math.PI) / 180;
    const radius = 1.04 * w * scale;
    const half = (n - 1) / 2;
    // The outer photos hang lower than the middle ones: lift the whole fan by half of that and reserve the other half below it.
    const drop = radius * (1 - Math.cos(half * step));
    stack.style.marginBottom = `${(drop / 2).toFixed(0)}px`;
    order.forEach((c, i) => {
      const a = (i - half) * step;
      c.el.style.zIndex = String(i + 1);
      c.el.style.opacity = '1';
      c.el.style.transform = `translate(${(Math.sin(a) * radius).toFixed(1)}px, ${(radius * (1 - Math.cos(a)) - drop / 2).toFixed(1)}px) rotate(${((a * 180) / Math.PI).toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      setAccess(c, 'pick');
    });
  }

  function setFan(on: boolean) {
    if (on ? mode !== 'idle' : mode !== 'fanned') return;
    mode = on ? 'fanned' : 'idle';
    clearTimeout(timer);
    stack.toggleAttribute('data-fan', on);
    stack.setAttribute('aria-label', on ? LABEL_FAN : LABEL_PILE);
    fanButton?.setAttribute('aria-pressed', String(on));
    const buttonLabel = on ? 'Close the fan' : 'Fan out the photos';
    fanButton?.setAttribute('aria-label', buttonLabel);
    fanButton?.setAttribute('title', buttonLabel);
    if (on) {
      layoutFan();
    } else {
      stack.style.marginBottom = '';
      render();
      schedule();
    }
  }

  /** Picking a photo from the fan brings it to the top of the pile. */
  function pick(card: Card) {
    const k = order.indexOf(card);
    order = [...order.slice(k), ...order.slice(0, k)];
    setFan(false);
    stack.focus({ preventScroll: true });
    announce();
  }

  const cardOf = (target: EventTarget | null) => {
    const el = target instanceof Element ? target.closest<HTMLElement>('[data-card]') : null;
    return el ? order.find((c) => c.el === el) : undefined;
  };

  // Pointer: tilt and glare on hover, drag to flick, tap to advance.
  stack.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hovering = true;
  });
  stack.addEventListener('pointerleave', () => {
    hovering = false;
    if (mode !== 'idle') return;
    const top = order[0];
    top.el.style.transition = '';
    top.el.style.transform = rest(top, 0);
    top.el.removeAttribute('data-tilt');
  });
  stack.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || mode !== 'idle' || reduced) return;
    const { el } = order[0];
    const box = stack.getBoundingClientRect();
    const nx = ((e.clientX - box.left) / box.width - 0.5) * 2;
    const ny = ((e.clientY - box.top) / box.height - 0.5) * 2;
    el.style.transition = 'transform 0.18s ease-out';
    el.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${(-ny * 9).toFixed(1)}deg) rotateY(${(nx * 11).toFixed(1)}deg) ${rest(order[0], 0)}`;
    el.style.setProperty('--gx', `${((nx + 1) * 50).toFixed(0)}%`);
    el.style.setProperty('--gy', `${((ny + 1) * 50).toFixed(0)}%`);
    el.dataset.tilt = '';
  });

  stack.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const hit = cardOf(e.target);
    if (mode === 'fanned') {
      if (hit) pick(hit);
      return;
    }
    const top = order[0];
    if (mode !== 'idle' || hit !== top) return;

    const started = startDrag(stack, e, {
      onMove({ dx, dy }) {
        top.el.style.transform = `perspective(${PERSPECTIVE}px) rotateX(${(-dy * 0.05).toFixed(1)}deg) rotateY(${(dx * 0.05).toFixed(1)}deg) translate(${dx}px, ${dy}px) rotate(${(dx * 0.07).toFixed(2)}deg)`;
      },
      onEnd(drag) {
        mode = 'idle';
        const { dx, dy } = drag;
        if (drag.cancelled) {
          // The browser took the gesture (a scroll started), so put the photo back.
          render();
          schedule();
        } else if (Math.hypot(dx, dy) < TAP_SLOP) {
          next(randomDir(), 0, true); // a tap
        } else {
          // A long enough drag goes the way it was dragged, a short one only if it was flung that way.
          const flung = !isStill(drag) && Math.hypot(drag.vx, drag.vy) > FLICK_SPEED;
          const vector = Math.hypot(dx, dy) > FLICK_DISTANCE ? [dx, dy] : flung ? [drag.vx, drag.vy] : null;
          if (vector) {
            flick(...unit(vector[0], vector[1]), true);
          } else {
            render();
            schedule();
          }
        }
      },
    });
    if (!started) return;
    mode = 'dragging';
    clearTimeout(timer);
    top.el.style.transition = 'none';
    top.el.removeAttribute('data-tilt');
  });

  stack.addEventListener('keydown', (e) => {
    const activate = e.key === 'Enter' || e.key === ' ';
    if (mode === 'fanned') {
      const card = cardOf(e.target);
      if (activate && card) {
        e.preventDefault();
        pick(card);
      }
    } else {
      const direction = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] ?? (activate ? [1, 0] : null);
      if (!direction) return;
      e.preventDefault();
      next(direction[0], direction[1], true);
    }
  });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || mode !== 'fanned') return;
    setFan(false);
    fanButton?.focus({ preventScroll: true });
  });
  fanButton?.addEventListener('click', (e) => {
    navigator.vibrate?.(10); // a small tap on phones that support it
    const opening = mode !== 'fanned';
    setFan(opening);
    // Opened from the keyboard: move focus onto the photos, which sit before the button in the page.
    if (opening && mode === 'fanned' && e.detail === 0) order[0].el.focus({ preventScroll: true });
  });
  // A tap anywhere outside the fan closes it.
  addEventListener('pointerdown', (e) => {
    if (mode !== 'fanned' || !(e.target instanceof Node)) return;
    if (!stack.contains(e.target) && !fanButton?.contains(e.target)) setFan(false);
  });
  addEventListener('resize', () => {
    if (mode === 'fanned') layoutFan();
  });

  // Deal the photos in from the sides, one after another, once the page has settled a little.
  if (reduced) {
    mode = 'idle';
    render();
  } else {
    order.forEach((c, i) => {
      const side = i % 2 ? 1 : -1;
      c.el.style.transition = 'none';
      c.el.style.opacity = '0';
      c.el.style.transform = `translate(${side * (innerWidth * 0.5 + 260)}px, -280px) rotate(${side * 40}deg)`;
    });
    void stack.offsetWidth;
    window.setTimeout(() => {
      order.forEach((c, i) => {
        c.el.style.transition = '';
        c.el.style.transitionDelay = `${(SHOWN - 1 - Math.min(i, SHOWN - 1)) * DEAL_STAGGER_MS}ms`;
      });
      render();
      window.setTimeout(
        () => {
          order.forEach((c) => (c.el.style.transitionDelay = ''));
          mode = 'idle';
          schedule();
        },
        (SHOWN - 1) * DEAL_STAGGER_MS + SPRING_MS,
      );
    }, DEAL_WAIT_MS);
  }
  stack.dataset.ready = '';
}
