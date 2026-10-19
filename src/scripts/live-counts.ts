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
    else if (values[key]) node.textContent = values[key];
  }
}

const groups = new Map<string, HTMLElement[]>();
for (const node of document.querySelectorAll<HTMLElement>('[data-live]')) {
  const key = `${node.dataset.marketplace ?? ''}|${node.dataset.openVsx ?? ''}`;
  groups.set(key, [...(groups.get(key) ?? []), node]);
}
groups.forEach((nodes) => void update(nodes));
