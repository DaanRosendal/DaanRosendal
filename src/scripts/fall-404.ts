// Tiny physics toy for the 404 page: the letters drop in, bounce off the floor, the window edges and each other, and can be dragged and thrown anywhere on the page.

import { startDrag, isStill } from './drag';

interface Body {
  el: HTMLElement;
  w: number;
  h: number;
  r: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  spin: number;
  held: boolean;
}

const GRAVITY = 2000; // px/s^2
const BOUNCE = 0.86; // speed kept after hitting a wall, the floor or another letter
const AIR = 0.85; // fraction of speed kept per second
const ROLL_FRICTION = 0.994; // fraction of sideways speed kept per step while on the floor
const STEP = 1 / 120; // fixed physics step, in seconds
const MAX_STEPS = 12; // per frame, so a slow tab cannot spiral
const GLYPH_SINK = 0.08; // the glyph sits this fraction of the box height above the bottom of its box
const STOP_SPEED = 6; // below this, a letter on the floor stops sliding
const BOUNCE_REST = 40; // below this vertical speed, a letter on the floor stops bouncing
const MOVING_SPEED = 20; // above this, a letter counts as moving
const CALM_FRAMES = 20; // frames without movement before the loop goes to sleep
const MAX_THROW = 2500; // px/s

export function fall(stage: HTMLElement) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.dataset.ready = '';
    return;
  }

  const els = [...stage.querySelectorAll<HTMLElement>('[data-letter]')];
  let height = stage.clientHeight;
  // The floor is the bottom of the stage, but the walls are the edges of the window, so the letters are not boxed in.
  let box = stage.getBoundingClientRect();
  let minX = 0;
  let maxX = 0;
  const measure = () => {
    box = stage.getBoundingClientRect();
    minX = -box.left;
    maxX = document.documentElement.clientWidth - box.left;
  };
  measure();

  // Read where the letters sit in the normal layout before taking them out of the flow.
  const bodies: Body[] = els.map((el, i) => {
    const rect = el.getBoundingClientRect();
    return {
      el,
      w: rect.width,
      h: rect.height,
      r: rect.width * 0.5,
      x: rect.left - box.left + rect.width / 2,
      // Start above the stage, staggered, so they drop in one after another.
      y: -rect.height * (1 + i * 0.9),
      vx: (Math.random() - 0.5) * 40,
      vy: 0,
      angle: (Math.random() - 0.5) * 0.6,
      spin: (Math.random() - 0.5) * 4,
      held: false,
    };
  });
  for (const b of bodies) {
    b.el.style.position = 'absolute';
    b.el.style.left = '0';
    b.el.style.top = '0';
  }

  const floorOf = (b: Body) => height - b.h * (0.5 - GLYPH_SINK);

  const draw = (b: Body) => {
    b.el.style.transform = `translate(${(b.x - b.w / 2).toFixed(1)}px, ${(b.y - b.h / 2).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`;
  };

  /** Keeps a letter inside the floor and the walls. With `bounce`, it also changes its speed like a real bounce. */
  function confine(b: Body, bounce: boolean) {
    const floor = floorOf(b);
    if (b.y > floor) {
      b.y = floor;
      if (bounce) {
        if (b.vy > 0) b.vy = -b.vy * BOUNCE;
        if (Math.abs(b.vy) < BOUNCE_REST) b.vy = 0;
        // Gentle rolling friction, so a letter glides to a stop over a few seconds instead of dropping dead.
        b.vx *= ROLL_FRICTION;
        if (Math.abs(b.vx) < STOP_SPEED) b.vx = 0;
        // Letters roll a bit as they slide, and stay at whatever angle they stop at.
        b.spin = b.spin * 0.97 + (b.vx / b.r) * 0.03;
      }
    }
    const half = b.w / 2;
    if (b.x < minX + half) {
      b.x = minX + half;
      if (bounce) b.vx = Math.abs(b.vx) * BOUNCE;
    } else if (b.x > maxX - half) {
      b.x = maxX - half;
      if (bounce) b.vx = -Math.abs(b.vx) * BOUNCE;
    }
  }

  /** Two letters push each other apart and trade momentum along the line between them. */
  function collide(a: Body, c: Body) {
    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const dist = Math.hypot(dx, dy) || 0.001;
    const min = (a.r + c.r) * 1.02;
    if (dist >= min) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const push = min - dist;
    const aw = a.held ? 0 : 1;
    const cw = c.held ? 0 : 1;
    const total = aw + cw || 1;
    a.x -= nx * push * (aw / total);
    a.y -= ny * push * (aw / total);
    c.x += nx * push * (cw / total);
    c.y += ny * push * (cw / total);
    const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
    if (rel >= 0) return;
    const impulse = -rel * (1 + BOUNCE) * 0.5;
    if (!a.held) {
      a.vx -= nx * impulse;
      a.vy -= ny * impulse;
    }
    if (!c.held) {
      c.vx += nx * impulse;
      c.vy += ny * impulse;
    }
    a.spin -= rel * 0.004;
    c.spin += rel * 0.004;
  }

  function integrate(dt: number) {
    const drag = Math.pow(AIR, dt);
    for (const b of bodies) {
      if (b.held) continue;
      b.vy += GRAVITY * dt;
      b.vx *= drag;
      b.vy *= drag;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;
      confine(b, true);
    }
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) collide(bodies[i], bodies[j]);
    }
    // A collision can push a letter past the floor or a wall, so put it back before it is drawn.
    for (const b of bodies) if (!b.held) confine(b, false);
  }

  let running = false;
  let last = 0;
  let acc = 0;
  let calm = 0;

  const moving = () => bodies.some((b) => b.held || Math.hypot(b.vx, b.vy) > MOVING_SPEED || Math.abs(b.spin) > 0.2);

  function frame(now: number) {
    measure();
    acc += Math.min((now - last) / 1000, 0.05);
    last = now;
    for (let steps = 0; acc >= STEP && steps < MAX_STEPS; steps++) {
      integrate(STEP);
      acc -= STEP;
    }
    for (const b of bodies) draw(b);
    calm = moving() ? 0 : calm + 1;
    if (calm < CALM_FRAMES) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    calm = 0;
    if (running) return;
    running = true;
    last = performance.now();
    acc = 0;
    requestAnimationFrame(frame);
  }

  // Dragging: the held letter follows the pointer, and on release it keeps the speed of the last few moments.
  for (const b of bodies) {
    b.el.addEventListener('pointerdown', (e) => {
      if (b.held) return;
      measure();
      const offX = e.clientX - box.left - b.x;
      const offY = e.clientY - box.top - b.y;
      const started = startDrag(b.el, e, {
        onMove(_drag, move) {
          measure();
          b.x = Math.min(Math.max(move.clientX - box.left - offX, minX + b.w / 2), maxX - b.w / 2);
          b.y = Math.min(move.clientY - box.top - offY, floorOf(b));
        },
        onEnd(drag) {
          const thrown = !drag.cancelled && !isStill(drag);
          const cap = (v: number) => Math.max(-MAX_THROW, Math.min(MAX_THROW, v));
          b.vx = thrown ? cap(drag.vx) : 0;
          b.vy = thrown ? cap(drag.vy) : 0;
          b.spin = b.vx / b.r;
          b.held = false;
          delete b.el.dataset.held;
          wake();
        },
      });
      if (!started) return;
      e.preventDefault();
      b.held = true;
      b.vx = b.vy = b.spin = 0;
      b.el.dataset.held = '';
      wake();
    });
  }

  new ResizeObserver(() => {
    const h = stage.clientHeight;
    measure();
    // The letters scale with the window height, so measure them again and keep each at the same distance from the floor.
    for (const b of bodies) {
      b.w = b.el.offsetWidth;
      b.h = b.el.offsetHeight;
      b.r = b.w * 0.5;
      b.y += h - height;
    }
    height = h;
    wake();
  }).observe(stage);
  addEventListener('resize', wake);

  for (const b of bodies) draw(b);
  stage.dataset.ready = '';
  stage.dataset.live = '';
  wake();
}
