import type { CollectionEntry } from 'astro:content';
import { formatCount, roundDown } from './count';

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

type Entry = CollectionEntry<'achievements'>;

// Fills {installs} (Marketplace), {downloads} (Open VSX) and {total} (both added together) in an entry's summary and
// stat, with the counts from the build (or the fallbacks when a source did not answer). {asOf} stays empty here: the
// browser fills it with " as of today" once it has fetched the live counts itself (see src/scripts/live-counts.ts).
//
// Returns plain text (`summary`, `stat`, `fill`) and an HTML variant (`summaryHtml`, `statHtml`, `fillHtml`) in which every
// filled value sits in a <span data-live="..."> that the browser can update.
export async function resolveAchievementText(entry: Entry) {
  const { summary, stat, marketplace, installsFallback, openVsx, downloadsFallback } = entry.data;
  const plain = (text: string) => text;
  if (!marketplace && !openVsx) {
    return { summary, stat, fill: plain, summaryHtml: summary, statHtml: stat, fillHtml: plain };
  }

  const [liveInstalls, liveDownloads] = await Promise.all([
    marketplace ? fetchInstalls(marketplace) : null,
    openVsx ? fetchOpenVsxDownloads(openVsx) : null,
  ]);
  const installs = marketplace ? (liveInstalls ?? installsFallback) : undefined;
  const downloads = openVsx ? (liveDownloads ?? downloadsFallback) : undefined;

  const tokens: Record<string, string> = { asOf: '' };
  if (installs !== undefined) tokens.installs = formatCount(installs);
  if (downloads !== undefined) tokens.downloads = formatCount(downloads);
  if (installs !== undefined && downloads !== undefined) tokens.total = formatCount(roundDown(installs) + roundDown(downloads));

  const source = `${marketplace ? ` data-marketplace="${marketplace}"` : ''}${openVsx ? ` data-open-vsx="${openVsx}"` : ''}`;
  // The invisible " as of today" reserves its space, so showing it later does not move the text below it.
  const html = (key: string) => (key === 'asOf'
    ? `<span data-live="asOf"${source} class="invisible"> as of today</span>`
    : `<span data-live="${key}"${source}>${tokens[key]}</span>`);

  const fill = (text: string) => text.replace(/\{(\w+)\}/g, (token, key) => tokens[key] ?? token);
  const fillHtml = (text: string) => text.replace(/\{(\w+)\}/g, (token, key) => (key in tokens ? html(key) : token));
  return { summary: fill(summary), stat: fill(stat), fill, summaryHtml: fillHtml(summary), statHtml: fillHtml(stat), fillHtml };
}
