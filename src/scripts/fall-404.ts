// Tiny physics toy for the 404 page: the letters drop in, bounce off the floor, the window edges and each other, and can be dragged and thrown anywhere on the page.

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

const GRAVITY = 2000;
const BOUNCE = 0.86;
const AIR = 0.85; // fraction of speed kept per second
const STEP = 1 / 120;
const MAX_STEPS = 12;

export function fall(stage: HTMLElement) {
  const els = [...stage.querySelectorAll<HTMLElement>('[data-letter]')];
  let height = stage.clientHeight;
  // The floor is the bottom of the stage, but the walls are the edges of the window, so the letters are not boxed in.
  let minX = 0;
  let maxX = stage.clientWidth;
  const measure = () => {
    const left = stage.getBoundingClientRect().left;
    minX = -left;
    maxX = document.documentElement.clientWidth - left;
  };
  measure();

  // Read where the letters sit in the normal layout before taking them out of the flow.
  const stageBox = stage.getBoundingClientRect();
  const bodies: Body[] = els.map((el, i) => {
    const box = el.getBoundingClientRect();
    return {
      el,
      w: box.width,
      h: box.height,
      r: box.width * 0.5,
      x: box.left - stageBox.left + box.width / 2,
      // Start above the stage, staggered, so they drop in one after another.
      y: -box.height * (1 + i * 0.9),
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

  const draw = (b: Body) => {
    b.el.style.transform = `translate(${(b.x - b.w / 2).toFixed(1)}px, ${(b.y - b.h / 2).toFixed(1)}px) rotate(${b.angle.toFixed(3)}rad)`;
  };

  let running = false;
  let last = 0;
  let acc = 0;

  const awake = () => bodies.some((b) => b.held || b.y < height || Math.hypot(b.vx, b.vy) > 8 || Math.abs(b.spin) > 0.2);

  function integrate(dt: number) {
    measure();
    const drag = Math.pow(AIR, dt);
    for (const b of bodies) {
      if (b.held) continue;
      b.vy += GRAVITY * dt;
      b.vx *= drag;
      b.vy *= drag;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.angle += b.spin * dt;

      // Floor: the glyph sits a little above the bottom of its line box, so the box can sink slightly below the stage.
      const floor = height - b.h / 2 + b.h * 0.08;
      if (b.y > floor) {
        b.y = floor;
        if (b.vy > 0) b.vy = -b.vy * BOUNCE;
        if (Math.abs(b.vy) < 40) b.vy = 0;
        // Gentle rolling friction, so a letter glides to a stop over a few seconds instead of dropping dead.
        b.vx *= 0.994;
        if (Math.abs(b.vx) < 6) b.vx = 0;
        // Letters roll a bit as they slide, and stay at whatever angle they stop at.
        b.spin = b.spin * 0.97 + (b.vx / b.r) * 0.03;
      }
      const half = b.w / 2;
      if (b.x < minX + half) {
        b.x = minX + half;
        b.vx = Math.abs(b.vx) * BOUNCE;
      } else if (b.x > maxX - half) {
        b.x = maxX - half;
        b.vx = -Math.abs(b.vx) * BOUNCE;
      }
    }

    // Letters push each other apart and trade momentum along the line between them.
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const c = bodies[j];
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const min = (a.r + c.r) * 1.02;
        if (dist >= min) continue;
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
        if (rel < 0) {
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
      }
    }
  }

  function frame(now: number) {
    acc += Math.min((now - last) / 1000, 0.05);
    last = now;
    let steps = 0;
    while (acc >= STEP && steps++ < MAX_STEPS) {
      integrate(STEP);
      acc -= STEP;
    }
    for (const b of bodies) draw(b);
    if (awake()) requestAnimationFrame(frame);
    else running = false;
  }

  function wake() {
    if (running) return;
    running = true;
    last = performance.now();
    acc = 0;
    requestAnimationFrame(frame);
  }

  // Dragging: the held letter follows the pointer, and on release it keeps the speed of the last few moments.
  for (const b of bodies) {
    b.el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      b.el.setPointerCapture(e.pointerId);
      const box = stage.getBoundingClientRect();
      const offX = e.clientX - box.left - b.x;
      const offY = e.clientY - box.top - b.y;
      let px = e.clientX;
      let py = e.clientY;
      let pt = performance.now();
      let vx = 0;
      let vy = 0;
      b.held = true;
      b.vx = b.vy = b.spin = 0;
      b.el.dataset.held = '';
      wake();

      const move = (m: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        measure();
        b.x = Math.min(Math.max(m.clientX - rect.left - offX, minX + b.w / 2), maxX - b.w / 2);
        b.y = Math.min(m.clientY - rect.top - offY, height - b.h / 2 + b.h * 0.08);
        const now = performance.now();
        const dt = Math.max((now - pt) / 1000, 0.001);
        vx = vx * 0.6 + ((m.clientX - px) / dt) * 0.4;
        vy = vy * 0.6 + ((m.clientY - py) / dt) * 0.4;
        px = m.clientX;
        py = m.clientY;
        pt = now;
      };
      const up = (u: PointerEvent) => {
        b.el.releasePointerCapture(u.pointerId);
        b.el.removeEventListener('pointermove', move);
        b.el.removeEventListener('pointerup', up);
        b.el.removeEventListener('pointercancel', up);
        // A pause before letting go means the letter was not thrown.
        const still = performance.now() - pt > 80;
        const cap = (v: number) => Math.max(-2500, Math.min(2500, v));
        b.vx = still ? 0 : cap(vx);
        b.vy = still ? 0 : cap(vy);
        b.spin = b.vx / b.r;
        b.held = false;
        delete b.el.dataset.held;
        wake();
      };
      b.el.addEventListener('pointermove', move);
      b.el.addEventListener('pointerup', up);
      b.el.addEventListener('pointercancel', up);
    });
  }

  new ResizeObserver(() => {
    const h = stage.clientHeight;
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
  wake();
}
