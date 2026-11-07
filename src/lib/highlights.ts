import type { CollectionEntry } from 'astro:content';

// The three groups on the home page. `id` is the `track` in an entry's frontmatter, `section` is the first
// segment of its detail URL, `label` is the heading above its column and `description` introduces its index page.
export const tracks = [
  { id: 'build', section: 'projects', label: 'Projects', description: 'Software I built, from a VS Code extension to an app for a bookstore.' },
  { id: 'compete', section: 'competitions', label: 'Competitions', description: 'Hackathons and tournaments I competed in.' },
  { id: 'research', section: 'research', label: 'Research', description: 'Published research and a year at CERN.' },
] as const;

export type Track = (typeof tracks)[number]['id'];

const sectionOf = Object.fromEntries(tracks.map((t) => [t.id, t.section])) as Record<Track, string>;

// /projects/<id>/, /competitions/<id>/ or /research/<id>/, depending on the entry's track.
export const highlightUrl = (entry: CollectionEntry<'highlights'>) => `/${sectionOf[entry.data.track]}/${entry.id}/`;
