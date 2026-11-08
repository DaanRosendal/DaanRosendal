// The photo pile on the 404 page. The photos are dealt in with a spring, the top one tilts in 3D with a glare that follows the cursor, and it flicks away to the side and tucks under the pile. The pile advances on its own, on tap or click, with the arrow keys, or by dragging the top photo away. A button fans all the photos out in an arc, and a soft glow behind the pile takes the colors of the current photo (sampled at build time into `data-glow`).

const SHOWN = 4; // photos visible in the pile
const AUTO_MS = 3400;

export function catStack(
  stack: HTMLElement,
  counter: HTMLElement | null,
  fanButton: HTMLElement | null,
  glow: HTMLElement | null,
) {
  const cards = [...stack.querySelectorAll<HTMLElement>('[data-card]')];
  const n = cards.length;
  if (n < 2) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Every photo has its own small tilt and offset, so the pile looks hand-dropped.
  const tilt = new Map(cards.map((c) => [c, { rot: (Math.random() - 0.5) * 12, x: (Math.random() - 0.5) * 14 }]));
  const layers = glow ? [...glow.children] as HTMLElement[] : [];
  let order = [...cards]; // top photo first
  let tucked: HTMLElement | null = null; // the photo that just went under the pile stays visible there
  let busy = true; // true while dealing in
  let fanned = false;
  let dragging = false;
  let hovering = false;
  let layer = 0;
  let timer = 0;

  const rest = (c: HTMLElement, depth: number) => {
    const t = tilt.get(c)!;
    const lift = Math.min(depth, SHOWN - 1);
    const rot = depth === 0 ? t.rot * 0.35 : t.rot;
    return `translate(${(t.x * (depth ? 1 : 0.3)).toFixed(1)}px, ${(-lift * 7).toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${(1 - lift * 0.045).toFixed(3)})`;
  };

  function setGlow() {
    const colors = order[0].dataset.glow?.split('|');
    if (!layers.length || !colors || colors.length < 4) return;
    layer = 1 - layer;
    const at = ['25% 25%', '75% 25%', '25% 75%', '75% 75%'];
    layers[layer].style.backgroundImage = colors.map((c, i) => `radial-gradient(circle at ${at[i]}, ${c}, transparent 65%)`).join(', ');
    layers.forEach((l, i) => l.toggleAttribute('data-on', i === layer));
  }

  function render() {
    order.forEach((c, i) => {
      c.style.zIndex = String(n - i);
      c.style.transform = rest(c, i);
      c.style.opacity = i < SHOWN || c === tucked ? '1' : '0';
      c.toggleAttribute('inert', i !== 0);
      c.setAttribute('aria-hidden', i === 0 ? 'false' : 'true');
      c.removeAttribute('data-tilt');
    });
    if (counter) counter.textContent = `${Number(order[0].dataset.card) + 1} / ${n}`;
    setGlow();
  }

  function flick(card: HTMLElement, dir: number, fromY = 0) {
    busy = true;
    clearTimeout(timer);
    order = order.slice(1);
    tucked = null;
    render(); // the rest of the pile moves up
    const out = (stack.offsetWidth * 0.62 + innerWidth * 0.08) * dir;
    card.removeAttribute('data-tilt');
    card.style.zIndex = String(n + 1);
    card.style.opacity = '1';
    card.style.transition = reduced ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.7, 0.3, 1)';
    card.style.transform = `translate(${out}px, ${-30 + fromY}px) rotate(${dir * 16}deg)`;
    setTimeout(() => {
      // Slide back in underneath the pile, with the springy transition from the stylesheet.
      order.push(card);
      tucked = card;
      render();
      card.style.transition = '';
      busy = false;
      schedule();
    }, reduced ? 0 : 400);
  }

  const next = (dir = Math.random() < 0.5 ? -1 : 1) => {
    if (busy || fanned) return;
    flick(order[0], dir);
  };

  function schedule() {
    clearTimeout(timer);
    if (reduced || fanned) return;
    timer = window.setTimeout(() => (document.hidden || hovering || dragging ? schedule() : next()), AUTO_MS);
  }

  function setFan(on: boolean) {
    if (busy && on) return;
    fanned = on;
    clearTimeout(timer);
    stack.toggleAttribute('data-fan', on);
    fanButton?.setAttribute('aria-pressed', String(on));
    if (!on) {
      stack.style.marginBottom = '';
      render();
      schedule();
      return;
    }
    // Cards sit on an arc, like a hand of playing cards.
    // The fan is about 2.9 photo-widths wide, so shrink it to fit the window.
    const w = stack.offsetWidth;
    const sc = Math.min(0.86, (innerWidth - 32) / (2.9 * w));
    const step = innerWidth < 560 ? 9 : 11;
    const radius = 1.04 * w * sc;
    const edge = ((((n - 1) / 2) * step) * Math.PI) / 180;
    // The outer cards hang lower than the middle ones: lift the whole fan by half of that and reserve the other half below it.
    const drop = radius * (1 - Math.cos(edge));
    stack.style.marginBottom = `${(drop / 2).toFixed(0)}px`;
    order.forEach((c, i) => {
      const a = ((i - (n - 1) / 2) * step * Math.PI) / 180;
      c.style.zIndex = String(i + 1);
      c.style.opacity = '1';
      c.removeAttribute('inert');
      c.setAttribute('aria-hidden', 'false');
      c.removeAttribute('data-tilt');
      c.style.transform = `translate(${(Math.sin(a) * radius).toFixed(1)}px, ${(radius * (1 - Math.cos(a)) - drop / 2).toFixed(1)}px) rotate(${((a * 180) / Math.PI).toFixed(2)}deg) scale(${sc.toFixed(3)})`;
    });
  }

  // Pointer: tilt and glare on hover, drag to flick, tap to advance.
  stack.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') hovering = true;
  });
  stack.addEventListener('pointerleave', () => {
    hovering = false;
    const top = order[0];
    if (!fanned && !busy && !dragging) {
      top.style.transition = '';
      top.style.transform = rest(top, 0);
      top.removeAttribute('data-tilt');
    }
  });
  stack.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || busy || fanned || dragging || reduced) return;
    const top = order[0];
    const box = stack.getBoundingClientRect();
    const nx = ((e.clientX - box.left) / box.width - 0.5) * 2;
    const ny = ((e.clientY - box.top) / box.height - 0.5) * 2;
    top.style.transition = 'transform 0.18s ease-out';
    top.style.transform = `perspective(900px) rotateX(${(-ny * 9).toFixed(1)}deg) rotateY(${(nx * 11).toFixed(1)}deg) ${rest(top, 0)}`;
    top.style.setProperty('--gx', `${((nx + 1) * 50).toFixed(0)}%`);
    top.style.setProperty('--gy', `${((ny + 1) * 50).toFixed(0)}%`);
    top.dataset.tilt = '';
  });

  stack.addEventListener('pointerdown', (e) => {
    const hit = (e.target as HTMLElement).closest<HTMLElement>('[data-card]');
    if (fanned) {
      // Picking a photo from the fan brings it to the top of the pile.
      if (!hit) return;
      const k = order.indexOf(hit);
      order = [...order.slice(k), ...order.slice(0, k)];
      setFan(false);
      return;
    }
    const top = order[0];
    if (busy || hit !== top) return;
    stack.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const startY = e.clientY;
    let dx = 0;
    let dy = 0;
    let vx = 0;
    let lastX = startX;
    let lastT = performance.now();
    dragging = true;
    clearTimeout(timer);
    top.style.transition = 'none';

    const move = (m: PointerEvent) => {
      dx = m.clientX - startX;
      dy = m.clientY - startY;
      const now = performance.now();
      vx = (m.clientX - lastX) / Math.max(now - lastT, 1);
      lastX = m.clientX;
      lastT = now;
      top.style.transform = `perspective(900px) rotateY(${(dx * 0.05).toFixed(1)}deg) translate(${dx}px, ${dy * 0.35}px) rotate(${(dx * 0.07).toFixed(2)}deg)`;
    };
    const up = () => {
      stack.removeEventListener('pointermove', move);
      stack.removeEventListener('pointerup', up);
      stack.removeEventListener('pointercancel', up);
      dragging = false;
      top.style.transition = '';
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) next(dx >= 0 ? 1 : -1); // a tap
      else if (Math.abs(dx) > 90 || Math.abs(vx) > 0.6) flick(top, dx >= 0 ? 1 : -1, dy * 0.35);
      else {
        render();
        schedule();
      }
    };
    stack.addEventListener('pointermove', move);
    stack.addEventListener('pointerup', up);
    stack.addEventListener('pointercancel', up);
  });

  stack.addEventListener('keydown', (e) => {
    if (fanned) return;
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      next(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      next(-1);
    }
  });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && fanned) setFan(false);
  });
  fanButton?.addEventListener('click', () => setFan(!fanned));
  addEventListener('resize', () => fanned && setFan(true));

  // Deal the photos in from the sides, one after another, once the page has settled a little.
  if (reduced) {
    busy = false;
    render();
  } else {
    order.forEach((c, i) => {
      const side = i % 2 ? 1 : -1;
      c.style.transition = 'none';
      c.style.opacity = '0';
      c.style.transform = `translate(${side * (innerWidth * 0.5 + 260)}px, -280px) rotate(${side * 40}deg)`;
    });
    void stack.offsetWidth;
    setTimeout(() => {
      order.forEach((c, i) => {
        c.style.transition = '';
        c.style.transitionDelay = `${(SHOWN - 1 - Math.min(i, SHOWN - 1)) * 140}ms`;
      });
      render();
      setTimeout(() => {
        order.forEach((c) => (c.style.transitionDelay = ''));
        busy = false;
        schedule();
      }, 1300);
    }, 120);
  }
  stack.dataset.ready = '';
}
