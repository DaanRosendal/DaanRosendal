import { getCollection } from 'astro:content';
import { education } from './education';
import { experiences } from './experience';
import { highlightUrl, tracks } from './highlights';
import { resolveHighlightText } from './marketplace';
import type { Bullet, TimelineItem } from './timeline';

const SITE = 'https://daanrosendal.com';

const bulletText = (bullet: Bullet) => (typeof bullet === 'string' ? bullet : bullet.text);

function timelineItem(item: TimelineItem) {
  const lines = [`- ${item.title}${item.badge ? ` (${item.badge})` : ''}, ${item.subtitle}, ${item.dates}, ${item.location}`];
  if (item.earlier) lines.push('  (An older role, left off the one-page resume.)');
  if (item.description) lines.push(`  ${item.description}`);
  if (item.via) lines.push(`  ${item.via.label}`);
  for (const link of item.links ?? []) lines.push(`  Project: ${link.label}, ${link.url}${link.stars ? `, ${link.stars} GitHub stars` : ''}`);
  for (const bullet of item.bullets ?? []) lines.push(`  * ${bulletText(bullet)}`);
  return lines.join('\n');
}

// Markdown body as plain text: links keep their text, other HTML is dropped.
const plain = (markdown: string) =>
  markdown
    .replace(/<a\b[^>]*>(.*?)<\/a>/gis, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Everything the chat assistant may say about Daan, as plain text, built from the same data the pages render.
// Install counts are the ones from the build, so they are dated.
export async function buildContext(): Promise<string> {
  const builtOn = new Date().toISOString().slice(0, 10);
  const entries = (await getCollection('highlights')).sort((a, b) => a.data.order - b.data.order);

  const highlights = await Promise.all(
    tracks.map(async (track) => {
      const group = entries.filter((entry) => entry.data.track === track.id);
      const blocks = await Promise.all(
        group.map(async (entry) => {
          const { summary, stat, fill } = await resolveHighlightText(entry);
          const links = entry.data.links.map((link) => `  ${link.label}: ${link.url}`);
          return [
            `### ${entry.data.title} (${entry.data.when})`,
            `Page: ${SITE}${highlightUrl(entry)}`,
            `Headline: ${stat}`,
            `Summary: ${summary}`,
            fill(plain(entry.body ?? '')),
            links.length ? `Links:\n${links.join('\n')}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        }),
      );
      return `## ${track.label}\n${track.description}\n\n${blocks.join('\n\n')}`;
    }),
  );

  return [
    `Context built on ${builtOn}. Counts of installs, downloads, and stars are as of that date.`,
    '',
    '# Daan Rosendal',
    'Software Engineer in Zürich, Switzerland. Building what people find useful. Now: AI security at Lakera AI. Ex-Microsoft, ex-CERN.',
    `Website: ${SITE}`,
    `Resume: ${SITE}/Daan_Rosendal_Resume.pdf`,
    'LinkedIn: https://linkedin.com/in/daanrosendal',
    'GitHub: https://github.com/DaanRosendal',
    'Email: contact@daanrosendal.com',
    '',
    '# Professional experience (newest first)',
    experiences.map(timelineItem).join('\n\n'),
    '',
    '# Education',
    education.map(timelineItem).join('\n\n'),
    '',
    '# Highlights',
    highlights.join('\n\n'),
    '',
  ].join('\n');
}
