// What Junior's reply shows while the answer has not started: one of ten small cat animations, chosen at random for each
// message (never the same one twice in a row). The markup is our own constant strings, not model output. The styles are in
// chat.css (the .think rules) and fall back to a still picture with reduced motion.

const paw = (cls = '') =>
  `<svg class="th-paw ${cls}" viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="16.2" rx="6.2" ry="5"/><ellipse cx="4.8" cy="10.3" rx="2.4" ry="3.1"/><ellipse cx="9.6" cy="6.3" rx="2.4" ry="3.3"/><ellipse cx="14.4" cy="6.3" rx="2.4" ry="3.3"/><ellipse cx="19.2" cy="10.3" rx="2.4" ry="3.1"/></svg>`;

// `label` is shown next to the animation. Without one, `hidden` is read by screen readers (and shown with reduced motion).
const VARIANTS: { name: string; art: string; label?: string; hidden?: string }[] = [
  { name: 'prints', art: `<div class="th-prints">${paw()}${paw()}${paw()}${paw()}</div>`, label: 'Junior is thinking' },
  {
    name: 'yarn',
    art: `<div class="th-yarn-track"><svg class="th-yarn" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="12" style="fill:var(--th-accent)"/><path d="M3 9c6 2 14 2 20 0M2 14c7 3 15 3 22 0M5 20c5 1.6 11 1.6 16 0M9 3c-3 6-3 14 0 20M16 2.5c3 6 3 15 0 21" fill="none" style="stroke:var(--c-bg)" stroke-width="1.3" stroke-linecap="round" opacity=".75"/></svg></div>`,
    hidden: 'Junior is thinking',
  },
  {
    name: 'tail',
    art: `<svg width="40" height="44" viewBox="0 0 40 44" fill="none" aria-hidden="true"><path class="th-tail" d="M20 42C9 33 30 25 19 8" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/></svg>`,
    label: 'Junior is thinking',
  },
  {
    name: 'eyes',
    art: `<svg class="th-eyes" width="58" height="30" viewBox="0 0 58 30" aria-hidden="true"><g class="th-lid"><ellipse cx="16" cy="15" rx="10" ry="12" style="fill:var(--th-eye)"/><ellipse cx="42" cy="15" rx="10" ry="12" style="fill:var(--th-eye)"/><g class="th-look"><ellipse cx="16" cy="15" rx="2.6" ry="9" style="fill:var(--th-pupil)"/><ellipse cx="42" cy="15" rx="2.6" ry="9" style="fill:var(--th-pupil)"/></g></g></svg>`,
    label: 'Junior is thinking',
  },
  {
    name: 'purr',
    art: `<span class="th-wave" aria-hidden="true">${[...'purrr..'].map((c) => `<span>${c}</span>`).join('')}</span>`,
    hidden: 'Junior is purring',
  },
  {
    name: 'ears',
    art: `<svg width="44" height="36" viewBox="0 0 44 36" aria-hidden="true"><polygon class="th-ear-l" points="8,19 9,3 21,13" fill="currentColor"/><polygon class="th-ear-r" points="36,19 35,3 23,13" fill="currentColor"/><ellipse cx="22" cy="23" rx="15.5" ry="12" fill="currentColor"/><circle cx="16" cy="23" r="2" style="fill:var(--c-bg)"/><circle cx="28" cy="23" r="2" style="fill:var(--c-bg)"/></svg>`,
    label: 'Junior is thinking',
  },
  { name: 'knead', art: `<div class="th-knead">${paw()}${paw()}</div>`, label: 'Junior is kneading' },
  {
    name: 'ring',
    art: `<div class="th-avatar"><div class="th-ring"></div><img src="/media/cat/junior-clean.webp" alt="" width="34" height="34" decoding="async"></div>`,
    label: 'Junior is thinking',
  },
  {
    name: 'mouse',
    art: `<div class="th-chase"><svg width="24" height="16" viewBox="0 0 24 16" aria-hidden="true"><path d="M4 11C-1 11-1 5 1 4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="12" cy="10" rx="8.5" ry="5" fill="currentColor"/><circle cx="17" cy="4.6" r="2.8" fill="currentColor"/><circle cx="20" cy="9.6" r="1" style="fill:var(--c-bg)"/></svg>${paw('th-chaser')}</div>`,
    hidden: 'Junior is thinking',
  },
  { name: 'laser', art: `<div class="th-laser"><i></i></div>`, label: 'Junior is on it' },
];

let last = -1;

export function thinking(): HTMLElement {
  let index = Math.floor(Math.random() * VARIANTS.length);
  if (index === last) index = (index + 1 + Math.floor(Math.random() * (VARIANTS.length - 1))) % VARIANTS.length;
  last = index;
  const variant = VARIANTS[index];
  const box = document.createElement('div');
  box.className = `think think-${variant.name}`;
  box.innerHTML = `${variant.art}<span class="${variant.label ? 'think-label' : 'think-label think-hidden'}">${variant.label ?? variant.hidden}</span>`;
  return box;
}
