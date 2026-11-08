// The "Ask about Daan" dialog. Loaded only when the visitor clicks the button (see AskDaan.astro), so the page
// itself makes no extra request. Everything the model writes is added as text nodes, never as HTML.

const SITEKEY = ['localhost', '127.0.0.1'].includes(location.hostname) ? '1x00000000000000000000AA' : '0x4AAAAAAF5IJpF-SESG-Kls';
const TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const MAX_HISTORY = 6;
const CONTACT = 'contact@daanrosendal.com';

const GREETING = 'Hi, I am an AI on Daan\'s site. I know his work, studies, and projects, and I am happy to chat about other things too.';
const SUGGESTIONS = ['What does Daan do at Lakera?', 'What did Daan build at CERN?', 'What is Pinboard for VS Code?', 'Tell me something fun'];

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

let dialog: HTMLDialogElement | undefined;
let widget: string | undefined;
let pending: { resolve(token: string): void; reject(error: Error): void } | undefined;
let turnstileLoading: Promise<void> | undefined;
const history: Turn[] = [];
let busy = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function closeIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
  svg.append(path);
  return svg;
}

// Plain text with web addresses and the email address turned into real links. Links are built as elements, so
// nothing the model writes can inject markup.
function show(target: HTMLElement, text: string) {
  const parts: (string | HTMLAnchorElement)[] = [];
  let last = 0;
  for (const match of text.matchAll(/https?:\/\/[^\s<>"]+|[\w.+-]+@[\w-]+\.[\w.-]+/g)) {
    const found = match[0].replace(/[.,;:!?)\]]+$/, '');
    const start = match.index ?? 0;
    parts.push(text.slice(last, start));
    const link = el('a', 'ask-link', found);
    link.href = found.includes('@') && !found.startsWith('http') ? `mailto:${found}` : found;
    if (!found.includes('@') || found.startsWith('http')) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
    parts.push(link);
    last = start + found.length;
  }
  parts.push(text.slice(last));
  target.replaceChildren(...parts);
}

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

function build() {
  const root = el('dialog', 'ask-dialog');
  root.setAttribute('aria-labelledby', 'ask-title');

  const head = el('div', 'ask-head');
  const title = el('h2', 'ask-title', 'Ask about Daan');
  title.id = 'ask-title';
  const close = el('button', 'ask-close');
  close.type = 'button';
  close.setAttribute('aria-label', 'Close');
  close.append(closeIcon());
  close.addEventListener('click', () => root.close());
  head.append(title, close);

  const note = el('p', 'ask-note', 'A public AI chat that knows this site. It can be wrong. Messages go to Cloudflare to be answered and are not stored here.');

  const log = el('div', 'ask-log');
  log.setAttribute('role', 'log');
  log.setAttribute('aria-label', 'Conversation');
  log.setAttribute('aria-live', 'polite');

  const form = el('form', 'ask-form');
  const input = el('textarea', 'ask-input');
  input.rows = 1;
  input.maxLength = 600;
  input.placeholder = 'Ask a question';
  input.setAttribute('aria-label', 'Your question');
  const send = el('button', 'ask-send', 'Send');
  send.type = 'submit';
  form.append(input, send);

  const slot = el('div', 'ask-turnstile');
  const foot = el('p', 'ask-foot');
  const privacy = el('a', 'ask-link', 'Cloudflare Turnstile');
  privacy.href = 'https://www.cloudflare.com/privacypolicy/';
  privacy.target = '_blank';
  privacy.rel = 'noopener noreferrer';
  foot.append('Protected by ', privacy, '. Limited to 20 messages a day.');

  const addMessage = (role: 'user' | 'assistant' | 'note', text: string) => {
    const bubble = el('div', `ask-msg ask-${role === 'note' ? 'notice' : role}`);
    show(bubble, text);
    log.append(bubble);
    log.scrollTop = log.scrollHeight;
    return bubble;
  };

  addMessage('assistant', GREETING);
  const suggestions = el('div', 'ask-suggestions');
  for (const text of SUGGESTIONS) {
    const chip = el('button', 'ask-chip', text);
    chip.type = 'button';
    chip.addEventListener('click', () => submit(text));
    suggestions.append(chip);
  }
  log.append(suggestions);

  const grow = () => {
    input.style.height = 'auto';
    const border = input.offsetHeight - input.clientHeight;
    const wanted = input.scrollHeight + border;
    input.style.height = `${Math.min(wanted, 128)}px`;
    input.style.overflowY = wanted > 128 ? 'auto' : 'hidden';
  };
  input.addEventListener('input', grow);
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
    suggestions.remove();
    input.value = '';
    grow();
    addMessage('user', text);
    history.push({ role: 'user', content: text });
    const answerBubble = addMessage('assistant', 'Thinking...');
    // Screen readers wait for the whole answer instead of announcing every streamed chunk.
    log.setAttribute('aria-busy', 'true');
    try {
      const turnstile = await humanToken(slot);
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history.slice(-MAX_HISTORY), turnstile }),
      });
      if (!response.ok || !response.body) {
        const problem = await response.json().catch(() => null);
        throw new Error(problem?.message ?? `The chat is unavailable right now. Please email ${CONTACT} instead.`);
      }
      const answer = await readAnswer(response, (soFar) => {
        show(answerBubble, soFar);
        log.scrollTop = log.scrollHeight;
      });
      if (!answer.trim()) throw new Error('No answer came back. Please try again.');
      history.push({ role: 'assistant', content: answer.trim() });
    } catch (error) {
      history.pop();
      answerBubble.remove();
      addMessage('note', error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      input.value = text;
      grow();
    } finally {
      log.removeAttribute('aria-busy');
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  root.append(head, note, log, slot, form, foot);
  root.addEventListener('click', (event) => {
    if (event.target === root) root.close();
  });
  root.addEventListener('close', () => {
    document.documentElement.style.overflow = '';
  });
  document.body.append(root);
  return { root, input };
}

let parts: ReturnType<typeof build> | undefined;

export function openChat() {
  parts ??= build();
  dialog = parts.root;
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  parts.input.focus();
  // Load the human check now, so the first answer does not wait for it.
  loadTurnstile().catch(() => {});
}
