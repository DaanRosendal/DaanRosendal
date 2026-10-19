import type { CollectionEntry } from 'astro:content';

const MARKETPLACE_ENDPOINT = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
const OPEN_VSX_API = 'https://open-vsx.org/api';
const INCLUDE_STATISTICS = 256;
const TIMEOUT_MS = 5000;

const cache = new Map<string, Promise<number | null>>();

// Any failure resolves to null, and the caller falls back to the last known count.
function cached(key: string, load: () => Promise<number | null>): Promise<number | null> {
  let pending = cache.get(key);
  if (!pending) {
    pending = load().catch(() => null);
    cache.set(key, pending);
  }
  return pending;
}

// The Marketplace has no documented public API, so this uses the query endpoint behind vsce and the
// Marketplace website.
const fetchInstalls = (itemName: string) =>
  cached(`marketplace:${itemName}`, async () => {
    const res = await fetch(MARKETPLACE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json;api-version=7.1-preview.1',
      },
      body: JSON.stringify({
        filters: [{ criteria: [{ filterType: 7, value: itemName }] }],
        flags: INCLUDE_STATISTICS,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stats: { statisticName: string; value: number }[] =
      data.results?.[0]?.extensions?.[0]?.statistics ?? [];
    const installs = stats.find((s) => s.statisticName === 'install')?.value;
    return typeof installs === 'number' ? installs : null;
  });

// Open VSX serves Cursor, Windsurf, VSCodium and other editors. Its downloadCount counts every download of the
// package, updates included, so it is a downloads figure and not a count of unique installs.
const fetchOpenVsxDownloads = (id: string) =>
  cached(`open-vsx:${id}`, async () => {
    const res = await fetch(`${OPEN_VSX_API}/${id}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const { downloadCount } = await res.json();
    return typeof downloadCount === 'number' ? downloadCount : null;
  });

// Rounds down so the number stays true between builds: 742 -> "740+", 4,482 -> "4,400+".
export function formatCount(count: number): string {
  if (count < 100) return String(count);
  const step = count < 1000 ? 10 : 100;
  return `${(Math.floor(count / step) * step).toLocaleString('en-US')}+`;
}

type Entry = CollectionEntry<'achievements'>;

// Fills {installs} (Marketplace), {downloads} (Open VSX) and {total} (both added together) in an entry's summary and
// stat, and returns `fill` for the same substitution in other text such as the rendered body. {asOf} becomes " as of today" only when every configured source answered, and is dropped otherwise.
export async function resolveAchievementText(entry: Entry) {
  const { summary, stat, marketplace, installsFallback, openVsx, downloadsFallback } = entry.data;
  if (!marketplace && !openVsx) return { summary, stat, fill: (text: string) => text };

  const [liveInstalls, liveDownloads] = await Promise.all([
    marketplace ? fetchInstalls(marketplace) : null,
    openVsx ? fetchOpenVsxDownloads(openVsx) : null,
  ]);
  const installs = marketplace ? (liveInstalls ?? installsFallback) : undefined;
  const downloads = openVsx ? (liveDownloads ?? downloadsFallback) : undefined;
  const isLive = (!marketplace || liveInstalls !== null) && (!openVsx || liveDownloads !== null);

  const tokens: Record<string, string> = { asOf: isLive ? ' as of today' : '' };
  if (installs !== undefined) tokens.installs = formatCount(installs);
  if (downloads !== undefined) tokens.downloads = formatCount(downloads);
  if (installs !== undefined && downloads !== undefined) tokens.total = formatCount(installs + downloads);

  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (token, key) => tokens[key] ?? token);
  return { summary: fill(summary), stat: fill(stat), fill };
}
