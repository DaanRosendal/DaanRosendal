// The chat. Loaded only when the visitor uses the pill, or when a minimised chat has to be restored on a new page
// (see ChatHost.astro for the static shell and the html[data-chat] modes). Everything the model writes is added as
// text nodes, never as HTML.
// The conversation's styles ride along with this script (an inline string), so pages that never use the chat do not carry them.
import { createRenderer } from '../vendor/limmat';
import limmatCss from '../vendor/limmat/style.css?inline';
import css from './chat.css?inline';

const SITEKEY = ['localhost', '127.0.0.1'].includes(location.hostname) ? '1x00000000000000000000AA' : '0x4AAAAAAF5IJpF-SESG-Kls';
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const MAX_HISTORY = 6;
const CONTACT = 'contact@daanrosendal.com';
const STORE = 'chat:v1';
const SITE = 'https://daanrosendal.com';


type Mode = 'full' | 'dock';

interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  execute(widget: string): void;
  reset(widget: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let turns: Turn[] = [];
let draft = '';
let widget: string | undefined;
let pending: { resolve(token: string): void; reject(error: Error): void } | undefined;
let turnstileLoading: Promise<void> | undefined;
let busy = false;
let pages = new Set<string>();
let ui: Awaited<ReturnType<typeof build>> | undefined;
let building: Promise<NonNullable<typeof ui>> | undefined;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const mode = () => root.dataset.chat as Mode | undefined;

// ---- Saved conversation (this tab only) ----

function readStore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    if (!saved || !Array.isArray(saved.turns)) return;
    turns = saved.turns.filter((turn: Turn) => (turn?.role === 'user' || turn?.role === 'assistant') && typeof turn.content === 'string');
    draft = typeof saved.draft === 'string' ? saved.draft : '';
  } catch {
    // Storage can be blocked: the chat then just forgets between pages.
  }
}

// A chat that is open when the page goes away comes back minimised on the next page.
function save() {
  try {
    const live = mode() !== undefined && turns.length > 0;
    sessionStorage.setItem(STORE, JSON.stringify({ mode: live ? 'dock' : 'closed', turns: turns.slice(-12), draft }));
  } catch {
    // See readStore.
  }
}

// ---- Links to pages on this site ----

// The chat steps aside into the dock, then the page changes, and the dock is already there on the next page.
function go(path: string) {
  if (mode() !== 'dock') setMode('dock');
  save();
  const target = new URL(path, location.href);
  const delay = reduceMotion.matches ? 0 : 320;
  setTimeout(() => {
    if (target.pathname === location.pathname && target.search === location.search) {
      if (target.hash) location.hash = target.hash;
      else window.scrollTo({ top: 0 });
    } else {
      location.assign(target);
    }
  }, delay);
}

// ---- Rendering the answer ----
// limmat builds the markdown as DOM nodes (never HTML) while the answer streams in. Links to pages that exist on this
// site are handled here, so the chat can step aside before the page changes.

const LANGS: Record<string, string> = { typescript: 'ts', tsx: 'ts', javascript: 'js', jsx: 'js', mjs: 'js', python: 'py', shell: 'bash', sh: 'bash', zsh: 'bash', yml: 'yaml', rust: 'rs', golang: 'go', cpp: 'c', 'c++': 'c', markdown: 'md', text: 'plain', txt: 'plain' };

function renderer(target: HTMLElement) {
  return createRenderer(target, {
    // The highlighter and each language load as their own small files, only when a code block closes.
    highlight: async (code, _text, lang) => {
      const { highlightElement } = await import('@speed-highlight/core');
      const name = lang.toLowerCase();
      await highlightElement(code, LANGS[name] ?? (name || 'plain'));
    },
    isInternalPath: (path) => pages.has(path.split(/[?#]/)[0]),
    onLinkClick: (href, event) => {
      if (!href.startsWith('/') || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
      go(href);
      return true;
    },
  });
}

// ---- Human check ----

function loadTurnstile() {
  turnstileLoading ??= new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = el('script');
    script.src = TURNSTILE_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      turnstileLoading = undefined;
      reject(new Error('The human check could not load. Please turn off content blockers for this page, or email me instead.'));
    };
    document.head.append(script);
  });
  return turnstileLoading;
}

// One fresh single-use token per message. The widget stays invisible unless Cloudflare wants an interaction.
async function humanToken(slot: HTMLElement) {
  await loadTurnstile();
  const turnstile = window.turnstile!;
  if (!widget) {
    widget = turnstile.render(slot, {
      sitekey: SITEKEY,
      action: 'chat',
      appearance: 'interaction-only',
      execution: 'execute',
      callback: (token: string) => pending?.resolve(token),
      'error-callback': () => pending?.reject(new Error('The human check failed. Please reload the page and try again.')),
      'expired-callback': () => pending?.reject(new Error('The human check expired. Please try again.')),
      'timeout-callback': () => pending?.reject(new Error('The human check timed out. Please try again.')),
    });
  } else {
    turnstile.reset(widget);
  }
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The human check took too long. Please try again.')), 30_000);
    pending = {
      resolve: (token) => (clearTimeout(timer), resolve(token)),
      reject: (error) => (clearTimeout(timer), reject(error)),
    };
    turnstile.execute(widget!);
  });
}

// The server streams Server-Sent Events: lines like `data: {"choices":[{"delta":{"content":"..."}}]}`.
async function readAnswer(response: Response, onPiece: (piece: string) => void) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let answer = '';
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') return;
    try {
      const chunk = JSON.parse(data);
      const raw = chunk.choices?.[0]?.delta?.content ?? chunk.response ?? '';
      // The prompt asks the model not to write em or en dashes, and this catches the ones that slip through
      // (a dash is a single character, so it never straddles two chunks).
      const piece = typeof raw === 'string' ? raw.replace(/[\u2013\u2014]/g, '-') : '';
      if (piece) {
        answer += piece;
        onPiece(piece);
      }
    } catch {
      // A partial or unknown line: skip it.
    }
  };
  for (;;) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      handle(buffer.slice(0, newline).trim());
      buffer = buffer.slice(newline + 1);
    }
    if (done) break;
  }
  handle(buffer.trim());
  return answer;
}

// ---- Modes ----

function pillRect() {
  const r = document.querySelector('.chat-pill')?.getBoundingClientRect();
  return r && r.width > 0 ? r : null;
}

let seaTimer: ReturnType<typeof setTimeout> | undefined;

// The water: it rises from the bottom when the chat opens, grows out of the dock window when the dock expands,
// shrinks into the dock window on minimise, and sinks when the chat closes from full screen.
function moveSea(sea: HTMLElement, from: Mode | undefined, to: Mode | undefined) {
  clearTimeout(seaTimer);
  const jump = (change: () => void) => {
    sea.classList.add('instant');
    change();
    void sea.offsetWidth;
    sea.classList.remove('instant');
  };
  if (to === 'full' && from === 'dock' && !reduceMotion.matches) {
    jump(() => sea.classList.add('up', 'docking'));
    sea.classList.remove('docking');
  } else if (to === 'full' && !from && !reduceMotion.matches && pillRect()) {
    // Out of the pill: the water starts as the pill's own shape and spreads over the screen.
    const r = pillRect()!;
    const right = document.documentElement.clientWidth - r.right;
    const bottom = innerHeight - r.bottom;
    jump(() => {
      sea.classList.add('up');
      sea.style.clipPath = `inset(${r.top}px ${right}px ${bottom}px ${r.left}px round ${r.height / 2}px)`;
    });
    sea.classList.add('from-pill');
    sea.style.clipPath = '';
    seaTimer = setTimeout(() => sea.classList.remove('from-pill'), 900);
  } else if (to === 'full') {
    sea.classList.remove('docking');
    sea.classList.add('up');
  } else if (from === 'full' && to === 'dock' && !reduceMotion.matches) {
    sea.classList.add('docking');
    seaTimer = setTimeout(() => jump(() => sea.classList.remove('up', 'docking')), 480);
  } else {
    sea.classList.remove('up', 'docking');
  }
}

let movingTimer: ReturnType<typeof setTimeout> | undefined;

function setMode(next: Mode | undefined) {
  const previous = mode();
  if (previous === next) return;
  // The text hides while the water rises (or sinks) and returns when it has settled.
  // (Between the dock and full screen the text stays: the window just clips it while it resizes.)
  if ((next === 'full' || previous === 'full') && previous !== 'dock' && next !== 'dock' && !reduceMotion.matches) {
    root.classList.add('chat-moving');
    clearTimeout(movingTimer);
    movingTimer = setTimeout(() => root.classList.remove('chat-moving'), next === 'full' ? 850 : 560);
  }
  if (next) root.dataset.chat = next;
  else delete root.dataset.chat;

  const full = next === 'full';
  if (ui) moveSea(ui.sea, previous, next);
  if (full) ui?.panel.setAttribute('aria-modal', 'true');
  else ui?.panel.removeAttribute('aria-modal');
  document.querySelector('main')?.toggleAttribute('inert', full);
  document.querySelector('.chat-revive')?.toggleAttribute('inert', full);
  root.style.overflow = full ? 'hidden' : '';
  save();
}

function focusSoon(target: HTMLElement | null | undefined) {
  // After the mode's display change has been applied.
  requestAnimationFrame(() => target?.focus({ preventScroll: true }));
}

async function ensureUi() {
  building ??= build();
  ui = await building;
  return ui;
}

export async function act(action: string) {
  const parts = await ensureUi();
  // The box was measured while the chat was hidden, so measure it again once it shows.
  requestAnimationFrame(parts.grow);
  if (action === 'expand' || action === 'minimise') {
    // The log changes height at once, so keep it pinned to the latest message instead of letting it jump.
    requestAnimationFrame(parts.scroll);
    setTimeout(parts.scroll, 480);
  }
  if (action === 'expand') {
    setMode('full');
    focusSoon(parts.input);
  } else if (action === 'minimise') {
    setMode('dock');
    focusSoon(parts.panel.querySelector<HTMLElement>('.chat-btn-expand'));
  } else if (action === 'close') {
    setMode(undefined);
    focusSoon(document.querySelector<HTMLElement>('.chat-pill-input'));
  }
}

// A question typed into the pill: the screen floods and the question goes out.
export async function send(text: string) {
  const parts = await ensureUi();
  setMode('full');
  requestAnimationFrame(parts.grow);
  parts.submit(text);
}

// The page came back from the browser's back-forward cache: the saved state may be newer than the frozen page.
export function sync() {
  readStore();
  if (!ui) return;
  ui.renderAll();
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) ?? 'null');
    if (saved?.mode === 'dock') setMode('dock');
    else if (mode() === 'dock') setMode(undefined);
  } catch {
    // See readStore.
  }
}

// ---- Building the conversation ----

async function build() {
  document.head.append(el('style', undefined, limmatCss + css));
  readStore();
  try {
    pages = new Set(await (await fetch('/chat-pages.json')).json());
  } catch {
    // Without the list, links to site pages stay plain text.
  }

  const panel = document.getElementById('chat')!;
  const body = panel.querySelector<HTMLElement>('.chat-body')!;

  const sea = el('div', 'chat-sea');
  sea.setAttribute('aria-hidden', 'true');
  const crest = el('div', 'sea-crest');
  crest.append(el('div', 'sea-wave'), el('div', 'sea-wave'), el('div', 'sea-wave'));
  sea.append(el('div', 'sea-body'), crest);
  document.body.append(sea);

  const log = el('div', 'chat-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Conversation');
  log.setAttribute('aria-live', 'polite');

  const form = el('form', 'chat-form');
  const input = el('textarea', 'chat-input');
  input.rows = 1;
  input.maxLength = 600;
  input.placeholder = 'Message Junior';
  input.setAttribute('aria-label', 'Message Junior');
  input.enterKeyHint = 'send';
  input.value = draft;
  const send = el('button', 'chat-send', 'Send');
  send.type = 'submit';
  form.append(input, send);

  const slot = el('div', 'chat-turnstile');

  const scroll = () => {
    log.scrollTop = log.scrollHeight;
  };
  const addMessage = (role: 'user' | 'assistant' | 'note', text: string) => {
    const bubble = el('div', `chat-msg chat-${role === 'note' ? 'notice' : role === 'user' ? 'user' : 'bot'}`);
    if (role === 'assistant') {
      const markdown = renderer(bubble);
      markdown.write(text);
      markdown.end();
    } else {
      bubble.textContent = text;
    }
    log.append(bubble);
    scroll();
    return bubble;
  };

  const renderAll = () => {
    log.replaceChildren();
    for (const turn of turns) addMessage(turn.role, turn.content);
    input.value = draft;
    grow();
    scroll();
  };

  const grow = () => {
    input.style.height = 'auto';
    const border = input.offsetHeight - input.clientHeight;
    const wanted = input.scrollHeight + border;
    input.style.height = `${Math.min(wanted, 128)}px`;
    input.style.overflowY = wanted > 128 ? 'auto' : 'hidden';
  };
  input.addEventListener('input', () => {
    grow();
    draft = input.value;
    save();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submit(input.value);
  });

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || busy) return;
    if (!navigator.onLine) {
      addMessage('note', `You seem to be offline. Please try again when you are back online, or email ${CONTACT}.`);
      return;
    }
    busy = true;
    send.disabled = true;
    input.value = draft = '';
    grow();
    addMessage('user', text);
    turns.push({ role: 'user', content: text });
    const answerBubble = el('div', 'chat-msg chat-bot chat-thinking', 'Thinking...');
    log.append(answerBubble);
    scroll();
    const markdown = renderer(answerBubble);
    // Screen readers wait for the whole answer instead of announcing every streamed chunk.
    log.setAttribute('aria-busy', 'true');
    try {
      const turnstile = await humanToken(slot);
      const page = { path: location.pathname, title: document.title.replace(/ - Daan Rosendal$/, '') };
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: turns.slice(-MAX_HISTORY), turnstile, page }),
      });
      if (!response.ok || !response.body) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.message ?? `The chat is unavailable right now. Please email ${CONTACT} instead.`);
      }
      let started = false;
      const answer = await readAnswer(response, (piece) => {
        if (!started) {
          started = true;
          answerBubble.classList.remove('chat-thinking');
          answerBubble.textContent = '';
        }
        markdown.write(piece);
        scroll();
      });
      markdown.end();
      if (!answer.trim()) throw new Error('No answer came back. Please try again.');
      turns.push({ role: 'assistant', content: answer.trim() });
    } catch (error) {
      turns.pop();
      markdown.destroy();
      answerBubble.remove();
      addMessage('note', error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      input.value = draft = text;
      grow();
    } finally {
      log.removeAttribute('aria-busy');
      busy = false;
      send.disabled = false;
      save();
      if (mode() !== 'dock') input.focus({ preventScroll: true });
    }
  }

  body.append(log, slot, form);
  renderAll();

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (mode() === 'full') void act('minimise');
  });
  addEventListener('pagehide', save);

  // Load the human check now, so the first answer does not wait for it.
  if (mode() !== 'dock') loadTurnstile().catch(() => {});
  else addEventListener('pointerdown', () => loadTurnstile().catch(() => {}), { once: true });

  return { panel, sea, input, renderAll, grow, submit, scroll };
}

// A minimised chat from the previous page: bring its conversation back.
if (mode()) void ensureUi();
