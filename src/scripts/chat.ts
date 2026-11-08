// The chat. Loaded only when the visitor uses the pill, or when a minimised chat has to be restored on a new page
// (see ChatHost.astro for the static shell and the html[data-chat] modes). Everything the model writes is added as
// text nodes, never as HTML.
// The conversation's styles ride along with this script (an inline string), so pages that never use the chat do not carry them.
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

// A path on this site that really exists (from /chat-pages.json), whether written as /path/ or as a full address.
function sitePath(href: string) {
  let path = href;
  if (path.startsWith(SITE)) path = path.slice(SITE.length) || '/';
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  const bare = path.split(/[?#]/)[0];
  return pages.has(bare) ? path : null;
}

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
// Plain text with web addresses and the email address turned into real links, built as elements so nothing the model
// writes can inject markup. A markdown renderer replaces this.

function renderText(target: HTMLElement, text: string) {
  const parts: (string | HTMLElement)[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+|[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    const found = match[0].replace(/[.,;:!?)\]]+$/, '');
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    last = start + found.length;
    const internal = found.startsWith(SITE) ? sitePath(found) : null;
    if (found.startsWith(SITE) && !internal) {
      parts.push(found);
      continue;
    }
    const link = el('a', 'chat-link', internal ?? found);
    if (internal) {
      link.href = internal;
      link.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        go(internal);
      });
    } else if (found.includes('@') && !found.startsWith('http')) {
      link.href = `mailto:${found}`;
    } else {
      link.href = found;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    parts.push(link);
  }
  parts.push(text.slice(last));
  target.replaceChildren(...parts);
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
async function readAnswer(response: Response, onText: (text: string) => void) {
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
      const piece = chunk.choices?.[0]?.delta?.content ?? chunk.response ?? '';
      if (typeof piece === 'string' && piece) onText((answer += piece));
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

function setMode(next: Mode | undefined) {
  const previous = mode();
  if (previous === next) return;
  if (next) root.dataset.chat = next;
  else delete root.dataset.chat;

  const full = next === 'full';
  ui?.sea.classList.toggle('up', full);
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
  document.head.append(el('style', undefined, css));
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
  input.placeholder = 'Ask a question';
  input.setAttribute('aria-label', 'Your question');
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
    const bubble = el('div', `chat-msg chat-plain chat-${role === 'note' ? 'notice' : role === 'user' ? 'user' : 'bot'}`);
    renderText(bubble, text);
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
    const answerBubble = addMessage('assistant', 'Thinking...');
    answerBubble.classList.add('chat-thinking');
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
      const answer = await readAnswer(response, (soFar) => {
        answerBubble.classList.remove('chat-thinking');
        renderText(answerBubble, soFar);
        scroll();
      });
      if (!answer.trim()) throw new Error('No answer came back. Please try again.');
      turns.push({ role: 'assistant', content: answer.trim() });
    } catch (error) {
      turns.pop();
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

  return { panel, sea, input, renderAll, grow, submit };
}

// A minimised chat from the previous page: bring its conversation back.
if (mode()) void ensureUi();
