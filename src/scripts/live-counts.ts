import { formatCount, roundDown } from '../lib/count';

const MARKETPLACE_ENDPOINT = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
const OPEN_VSX_API = 'https://open-vsx.org/api';
const INCLUDE_STATISTICS = 256;
const TIMEOUT_MS = 5000;

async function fetchInstalls(itemName: string): Promise<number | null> {
  const res = await fetch(MARKETPLACE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json;api-version=7.1-preview.1' },
    body: JSON.stringify({ filters: [{ criteria: [{ filterType: 7, value: itemName }] }], flags: INCLUDE_STATISTICS }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const stats: { statisticName: string; value: number }[] = data.results?.[0]?.extensions?.[0]?.statistics ?? [];
  const installs = stats.find((s) => s.statisticName === 'install')?.value;
  return typeof installs === 'number' ? installs : null;
}

async function fetchDownloads(id: string): Promise<number | null> {
  const res = await fetch(`${OPEN_VSX_API}/${id}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const { downloadCount } = await res.json();
  return typeof downloadCount === 'number' ? downloadCount : null;
}

const NOTES: Record<string, string> = {
  installs: 'Fetched live from the VS Code Marketplace',
  downloads: 'Fetched live from Open VSX',
  total: 'Fetched live from the VS Code Marketplace and Open VSX',
};

// One small tooltip, shared by every live number. It is a real element (not CSS) so it can stay inside the viewport.
const tip = document.createElement('div');
tip.id = 'live-tip';
tip.role = 'tooltip';
tip.hidden = true;

function showTip(node: HTMLElement) {
  tip.textContent = node.dataset.note ?? '';
  tip.hidden = false;
  const rect = node.getBoundingClientRect();
  const { width, height } = tip.getBoundingClientRect();
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
  const top = rect.top - height - 8 >= 8 ? rect.top - height - 8 : rect.bottom + 8;
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

const hideTip = () => { tip.hidden = true; };

// A number that came from a live request gets a dotted underline and the tooltip, on hover and on keyboard focus.
function markLive(node: HTMLElement, key: string) {
  if (!NOTES[key]) return;
  if (!tip.isConnected) {
    document.body.append(tip);
    window.addEventListener('scroll', hideTip, { passive: true });
    document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTip(); });
  }
  node.dataset.note = NOTES[key];
  node.tabIndex = 0;
  node.setAttribute('aria-describedby', tip.id);
  node.addEventListener('pointerenter', () => showTip(node));
  node.addEventListener('pointerleave', hideTip);
  node.addEventListener('focus', () => showTip(node));
  node.addEventListener('blur', hideTip);
}

const attempt = (load: () => Promise<number | null>) => load().catch(() => null);

// Replaces the counts from the build with the current ones. When a request fails the numbers from the build stay.
// " as of today" only appears when every source answered.
async function update(nodes: HTMLElement[]) {
  const { marketplace, openVsx } = nodes[0].dataset;
  const [installs, downloads] = await Promise.all([
    marketplace ? attempt(() => fetchInstalls(marketplace)) : null,
    openVsx ? attempt(() => fetchDownloads(openVsx)) : null,
  ]);

  const values: Record<string, string> = {};
  if (installs !== null && installs !== undefined) values.installs = formatCount(installs);
  if (downloads !== null && downloads !== undefined) values.downloads = formatCount(downloads);
  if (installs != null && downloads != null) values.total = formatCount(roundDown(installs) + roundDown(downloads));
  const isLive = (!marketplace || installs != null) && (!openVsx || downloads != null);

  for (const node of nodes) {
    const key = node.dataset.live!;
    if (key === 'asOf') node.classList.toggle('invisible', !isLive);
    else if (values[key]) {
      node.textContent = values[key];
      markLive(node, key);
    }
  }
}

const groups = new Map<string, HTMLElement[]>();
for (const node of document.querySelectorAll<HTMLElement>('[data-live]')) {
  const key = `${node.dataset.marketplace ?? ''}|${node.dataset.openVsx ?? ''}`;
  groups.set(key, [...(groups.get(key) ?? []), node]);
}
groups.forEach((nodes) => void update(nodes));
